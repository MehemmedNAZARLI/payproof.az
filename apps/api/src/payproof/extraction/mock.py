"""`AI_PROVIDER=mock` (default): pre-made results from fixtures/samples.json by file name —
the package's current extraction with the sample's correction applied. The UI labels it as a
pre-made result ("əvvəlcədən hazırlanmış nəticə"). A scan without a sample leaves the PO unread."""

import datetime as dt
from dataclasses import replace
from decimal import Decimal
from functools import cache
from typing import Any

from payproof.domain.enums import Currency
from payproof.domain.format import format_money, format_qty
from payproof.domain.money import Money
from payproof.domain.rules.paths import (
    DELIVERY_CUSTOMER,
    DELIVERY_PO,
    DELIVERY_SIGNATURE,
    INVOICE_CUSTOMER,
    INVOICE_PO,
    INVOICE_TOTAL,
    line,
)
from payproof.extraction.base import (
    DeliveryData,
    Evidence,
    ExtractionInput,
    ExtractionResult,
    InvoiceData,
    LineData,
)
from payproof.seed.fixtures import UNITS, load

UNREAD = "oxunmur"


@cache
def _samples() -> dict[tuple[str, str], dict[str, Any]]:
    return {(s["file_name"], s["type"]): s["extraction"] for s in load("samples.json")}


def _price(value: Decimal | None, currency: str | None) -> str:
    if value is None:
        return UNREAD
    return format_money(Money(value, Currency(currency))) if currency else f"{value:.2f}"


def _qty(li: LineData) -> str:
    return f"{format_qty(li.qty) if li.qty is not None else UNREAD} {li.unit or UNREAD}"


def invoice_evidence(inv: InvoiceData, customer: str) -> list[Evidence]:
    """Quotes as the pre-made files print them (also used by the seed)."""
    po = f"{inv.po_raw or '?'} ({UNREAD})" if INVOICE_PO in inv.unreadable else inv.po_ref
    out = [
        Evidence(INVOICE_PO, 1, f"Sifariş №: {po or '—'}"),
        Evidence(INVOICE_CUSTOMER, 1, f"Alıcı: {customer}"),
        Evidence(INVOICE_TOTAL, 1, f"Yekun: {_price(inv.total, inv.currency)}"),
    ]
    for li in inv.lines:
        quote = f"{li.product_code} — {_qty(li)} × {_price(li.unit_price, inv.currency)}"
        out += [
            Evidence(line("invoice", li.product_code, "qty"), 1, quote),
            Evidence(line("invoice", li.product_code, "unit_price"), 1, quote),
        ]
    return out


def delivery_evidence(d: DeliveryData, customer: str) -> list[Evidence]:
    signed = {None: UNREAD, True: "doldurulub", False: "boş"}[d.signed]
    out = [
        Evidence(DELIVERY_PO, 1, f"Əsas: sifariş {d.po_ref or UNREAD}"),
        Evidence(DELIVERY_CUSTOMER, 1, f"Qəbul edən: {customer}"),
        Evidence(DELIVERY_SIGNATURE, 1, f"Qəbul edənin imzası: {signed}"),
    ]
    for li in d.lines:
        qty = format_qty(li.qty) if li.qty is not None else UNREAD
        quote = f"{li.product_code} — {qty} təhvil verilib"
        out.append(Evidence(line("delivery", li.product_code, "qty"), 1, quote))
    return out


def _corrected_invoice(inv: InvoiceData, x: dict[str, Any]) -> InvoiceData:
    lines = list(inv.lines)
    if fix := x.get("line"):
        lines = [
            replace(
                li,
                qty=Decimal(str(fix["qty"])) if "qty" in fix else li.qty,
                unit_price=Decimal(fix["unit_price"]) if "unit_price" in fix else li.unit_price,
            )
            if li.product_code == fix["product_code"]
            else li
            for li in lines
        ]
    known = all(li.qty is not None and li.unit_price is not None for li in lines)
    total = sum(
        ((li.qty or Decimal(0)) * (li.unit_price or Decimal(0)) for li in lines), Decimal(0)
    )
    return InvoiceData(
        po_ref=x.get("po_ref", inv.po_ref),
        po_raw=None,
        currency=x.get("currency", inv.currency),
        total=total.quantize(Decimal("0.01")) if known else None,
        lines=tuple(lines),
    )  # a corrected file is read in full: nothing left for review


def newset_for(file_name: str) -> dict[str, Any] | None:
    """Demo document set (fixtures/newsets.json) a file belongs to — a new package's documents."""
    return next((n for n in load("newsets.json") if file_name in n["files"]), None)


def _new_invoice(n: dict[str, Any]) -> InvoiceData:
    lines = tuple(
        LineData(li["product_code"], Decimal(str(li["qty"])), UNITS[li["product_code"]],
                 Decimal(li["unit_price"]))
        for li in n["lines"]
    )  # fmt: skip
    total = sum((li.qty * li.unit_price for li in lines if li.qty and li.unit_price), Decimal(0))
    return InvoiceData(n["po_number"], None, n["currency"], total.quantize(Decimal("0.01")), lines)


class MockExtractionAdapter:
    async def extract(self, src: ExtractionInput) -> ExtractionResult:
        x = _samples().get((src.file_name, src.doc_type))
        new = newset_for(src.file_name)
        if src.doc_type == "invoice" and src.invoice is None and new:
            inv = _new_invoice(new)
            return ExtractionResult(
                "mock", invoice=inv, evidence=tuple(invoice_evidence(inv, src.customer))
            )
        if src.doc_type == "delivery" and src.delivery is None and new and new["delivery"]:
            x = {"delivery": {**new["delivery"], "signed": True}}  # the demo note is signed
        if src.doc_type == "invoice" and src.invoice:
            inv = src.invoice
            if x is not None:
                inv = _corrected_invoice(inv, x)
            elif src.scanned:
                inv = replace(inv, po_ref=None, po_raw=None, unreadable=frozenset({INVOICE_PO}))
            return ExtractionResult(
                "mock", invoice=inv, evidence=tuple(invoice_evidence(inv, src.customer))
            )
        if src.doc_type == "delivery" and ((x and "delivery" in x) or src.delivery):
            d = self._delivery(src, x["delivery"] if x else None)
            return ExtractionResult(
                "mock", delivery=d, evidence=tuple(delivery_evidence(d, src.customer))
            )
        return ExtractionResult("mock", warnings=("no pre-made result for this file",))

    @staticmethod
    def _delivery(src: ExtractionInput, x: dict[str, Any] | None) -> DeliveryData:
        if x is None:
            assert src.delivery is not None  # noqa: S101 — checked by the caller
            return src.delivery
        lines = src.invoice.lines if src.invoice else ()
        return DeliveryData(
            note_number=x["note_number"],
            po_ref=x["po_ref"],
            customer_id=src.customer_id,
            signed=x["signed"],
            delivery_date=dt.datetime.now(dt.UTC).date(),
            lines=tuple(LineData(li.product_code, li.qty, li.unit) for li in lines),
        )  # the sample delivers what was invoiced (mock convention)
