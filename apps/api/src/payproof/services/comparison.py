"""Field-by-field comparison table of a package (port of the prototype `comparePanel()` /
mock `comparison()`). Display values are decimal strings; nothing is converted."""

import uuid
from collections.abc import Callable, Mapping
from decimal import Decimal

from payproof.domain.money import Money
from payproof.domain.rules.paths import INVOICE_PO, line
from payproof.domain.snapshot import PackageSnapshot
from payproof.schemas.detail import ComparisonCell, ComparisonRow, Evidence

State = str  # "ok" | "mismatch" | "unknown" | "empty"
EvidenceOf = Callable[[str], Evidence | None]


def _qty(q: Decimal | None) -> str | None:
    return None if q is None else f"{q.normalize():f}"


def _money(m: Money | None) -> str | None:
    return None if m is None else str(m)


def _cell(value: str | None, bad: State | None = None, **extra: object) -> ComparisonCell:
    # an empty value is "empty" unless the rule already says it is unknown or wrong
    state = "empty" if value is None and bad not in ("unknown", "mismatch") else (bad or "ok")
    return ComparisonCell(value=value, state=state, **extra)


def comparison_rows(
    s: PackageSnapshot,
    *,
    descriptions: Mapping[str, str],
    field_ids: Mapping[str, uuid.UUID],
    evidence: EvidenceOf = lambda _: None,
) -> list[ComparisonRow]:
    o, d, cur = s.order, s.delivery, s.currency
    same_cur = o is not None and o.currency == cur
    linked = d is not None and o is not None and d.po_ref == o.po
    name = {cid: p.name for cid, p in s.parties.items()}
    rows: list[ComparisonRow] = []

    def add(
        key: str,
        label: str,
        inv: ComparisonCell,
        ord_: ComparisonCell,
        dlv: ComparisonCell,
        group: str | None = None,
    ) -> None:
        rows.append(
            ComparisonRow(key=key, group=group, label=label, invoice=inv, order=ord_, delivery=dlv)
        )

    unread = INVOICE_PO in s.invoice.unreadable_fields
    po = s.invoice.po_ref
    po_bad = "unknown" if unread else "mismatch" if not po or (o and po != o.po) else None
    add(
        "po_ref",
        "Sifariş № (PO)",
        _cell(
            None if unread else po,
            po_bad,
            field_id=field_ids.get(INVOICE_PO),
            evidence=evidence(INVOICE_PO),
        ),
        _cell(o.po if o else None),
        _cell(
            d.po_ref if d else None,
            "unknown" if d and o and d.po_ref != o.po else None,
            evidence=evidence("delivery.po_ref"),
        ),
    )
    add(
        "customer",
        "Alıcı",
        _cell(name.get(s.customer_id), evidence=evidence("invoice.customer")),
        _cell(
            name.get(o.customer_id) if o else None,
            "mismatch" if o and o.customer_id != s.customer_id else None,
        ),
        _cell(
            name.get(d.customer_id) if d and d.customer_id else None,
            "mismatch" if d and d.customer_id and d.customer_id != s.customer_id else None,
            evidence=evidence("delivery.customer"),
        ),
    )
    add(
        "currency",
        "Valyuta",
        _cell(str(cur)),
        _cell(str(o.currency) if o else None, "unknown" if o and not same_cur else None),
        _cell(None),
    )
    ordered = {ol.code: ol for ol in o.lines} if o else {}
    delivered = {dl.code: dl.qty for dl in d.lines} if d and linked else {}
    for li in s.invoice.lines:
        code, ol = li.code, ordered.get(li.code)
        group = f"{code} · {descriptions.get(code, code)}"
        got = delivered.get(code) if code in delivered else None
        qty_bad = (same_cur and ol is not None and ol.qty != li.qty) or (
            code in delivered and got != li.qty
        )
        add(
            f"lines[{code}].qty",
            f"Miqdar ({li.unit or (ol.unit if ol else '') or ''})",
            _cell(
                _qty(li.qty),
                "mismatch" if qty_bad else None,
                field_id=field_ids.get(line("invoice", code, "qty")),
                evidence=evidence(line("invoice", code, "qty")),
            ),
            _cell(_qty(ol.qty) if ol else None),
            _cell(
                _qty(got),
                "mismatch" if code in delivered and got != li.qty else None,
                evidence=evidence(line("delivery", code, "qty")) if code in delivered else None,
            ),
            group,
        )
        price_bad = same_cur and ol is not None and ol.unit_price != li.unit_price
        add(
            f"lines[{code}].unit_price",
            "Vahid qiymət",
            _cell(
                _money(li.unit_price),
                "mismatch" if price_bad else None,
                currency=cur,
                field_id=field_ids.get(line("invoice", code, "unit_price")),
                evidence=evidence(line("invoice", code, "unit_price")),
            ),
            _cell(
                _money(ol.unit_price) if ol else None,
                "unknown" if o and not same_cur else None,
                currency=o.currency if ol and o else None,
            ),
            _cell(None),
            group,
        )
    order_total = Money.sum((ol.unit_price * ol.qty for ol in o.lines), o.currency) if o else None
    add(
        "total",
        "Yekun məbləğ",
        _cell(_money(s.invoice.total), currency=cur, evidence=evidence("invoice.total")),
        _cell(
            _money(order_total),
            "unknown" if o and not same_cur else None,
            currency=o.currency if o else None,
        ),
        _cell(None),
        "Cəmlər",
    )
    return rows
