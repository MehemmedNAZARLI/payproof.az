"""R-009 — the invoice lines add up to its total, within the customer's rounding tolerance."""

from payproof.domain.enums import CheckOutcome
from payproof.domain.format import format_money
from payproof.domain.money import Money
from payproof.domain.rules.paths import INVOICE_TOTAL
from payproof.domain.rules.result import CheckResult, FixHint, evidence_for, no_lines
from payproof.domain.snapshot import PackageSnapshot

RULE = "R-009"


def r009(s: PackageSnapshot) -> CheckResult:
    if empty := no_lines(RULE, s):
        return empty
    inv, ev = s.invoice, evidence_for(s, INVOICE_TOTAL)
    amounts = [
        li.unit_price * li.qty
        for li in inv.lines
        if li.unit_price is not None and li.qty is not None
    ]
    if inv.total is None or len(amounts) != len(inv.lines):
        # not in the rules table: arithmetic on an unread amount is never PASS
        return CheckResult(
            RULE,
            CheckOutcome.UNKNOWN,
            "Sətirlərin cəmi və ya yekun məbləğ oxunmadı. Mənbəyə baxıb sahəni təsdiqləyin.",
            ev,
            fix_hint=FixHint.EDIT_FIELD,
        )
    lines_sum = Money.sum(amounts, s.currency)
    diff = lines_sum - inv.total
    if abs(diff) <= Money(s.rules.tolerance, s.currency):
        return CheckResult(
            RULE,
            CheckOutcome.PASS,
            f"Sətirlərin cəmi {format_money(lines_sum)} yekun məbləğə uyğundur.",
            ev,
        )
    return CheckResult(
        RULE,
        CheckOutcome.FAIL,
        f"Sətirlərin cəmi {format_money(lines_sum)}, fakturadakı yekun "
        f"{format_money(inv.total)}. Fərq: {format_money(diff)}.",
        ev,
        fix_hint=FixHint.UPLOAD_INVOICE,
    )
