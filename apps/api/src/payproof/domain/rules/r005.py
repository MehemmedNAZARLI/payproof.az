"""R-005 — invoice unit prices equal the order's; the difference is reported, never judged."""

from payproof.domain.enums import CheckOutcome
from payproof.domain.format import format_money, format_qty
from payproof.domain.money import Money
from payproof.domain.rules.paths import line
from payproof.domain.rules.result import CheckResult, FixHint, evidence_for, no_lines
from payproof.domain.snapshot import InvoiceLine, PackageSnapshot

RULE = "R-005"


def _unread_path(li: InvoiceLine) -> str:
    return line("invoice", li.code, "qty" if li.qty is None else "unit_price")


def r005(s: PackageSnapshot, *, comparable: bool) -> CheckResult:
    """`comparable` is R-004's PASS (same currency and units)."""
    order = s.order
    if not comparable or order is None:
        return CheckResult(
            RULE,
            CheckOutcome.UNKNOWN,
            "Valyuta və vahid uyğunluğu təsdiqlənmədən qiymət müqayisə edilmir.",
            cascade=True,
        )
    if empty := no_lines(RULE, s):
        return empty
    prices = {ol.code: ol.unit_price for ol in order.lines}
    lines = s.invoice.lines
    if missing := [li.code for li in lines if li.code not in prices]:
        return CheckResult(
            RULE,
            CheckOutcome.UNKNOWN,
            f"Sifarişdə olmayan sətir: {', '.join(missing)}. Avtomatik uyğun sayılmır.",
            evidence_for(s, *(line("invoice", c, "unit_price") for c in missing)),
        )
    read = [
        (li.code, price, qty)
        for li in lines
        if (price := li.unit_price) is not None and (qty := li.qty) is not None
    ]
    if unread := [li.code for li in lines if li.code not in {code for code, _, _ in read}]:
        # not in the rules table: a difference cannot be computed, so this is never PASS
        return CheckResult(
            RULE,
            CheckOutcome.UNKNOWN,
            f"Vahid qiymət və ya miqdar oxunmadı: {', '.join(unread)}. "
            "Mənbəyə baxıb sahəni təsdiqləyin.",
            evidence_for(s, *(_unread_path(li) for li in lines if li.code in unread)),
            fix_hint=FixHint.EDIT_FIELD,
        )
    parts: list[str] = []
    diffs: list[Money] = []
    paths: list[str] = []
    for code, price, qty in read:
        ordered = prices[code]
        if price == ordered:
            continue
        diff = (price - ordered) * qty
        diffs.append(diff)
        parts.append(
            f"{code}: fakturada {format_money(price)}, sifarişdə "
            f"{format_money(ordered)} × {format_qty(qty)} = {format_money(diff)} fərq"
        )
        paths += [line("invoice", code, "unit_price"), line("order", code, "unit_price")]
    if diffs:
        total = Money.sum(diffs, s.currency)
        return CheckResult(
            RULE,
            CheckOutcome.FAIL,
            "; ".join(parts)
            + ". Aktual qiymət əlavəsini yoxlayın. Fərq itki və ya gəlir sayılmır.",
            evidence_for(s, *paths),
            fix_hint=FixHint.UPLOAD_INVOICE,
            data={"line_difference": {"amount": str(total), "currency": str(total.currency)}},
        )
    first = lines[0].code
    return CheckResult(
        RULE,
        CheckOutcome.PASS,
        f"{len(lines)} sətirdə vahid qiymət sifarişlə eynidir.",
        evidence_for(s, line("invoice", first, "unit_price"), line("order", first, "unit_price")),
    )
