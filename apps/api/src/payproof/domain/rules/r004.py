"""R-004 — invoice and order use the same currency and units; never converted automatically.
Its PASS is what makes prices and quantities comparable (R-005, R-006)."""

from payproof.domain.enums import CheckOutcome
from payproof.domain.rules.paths import INVOICE_TOTAL, ORDER_TOTAL
from payproof.domain.rules.result import CheckResult, FixHint, evidence_for
from payproof.domain.snapshot import PackageSnapshot

RULE = "R-004"


def comparable(r004_result: CheckResult) -> bool:
    return r004_result.outcome is CheckOutcome.PASS


def r004(s: PackageSnapshot) -> CheckResult:
    order = s.order
    if order is None:
        return CheckResult(
            RULE,
            CheckOutcome.UNKNOWN,
            "Sifariş təsdiqlənmədən valyuta və vahid müqayisə olunmur.",
            cascade=True,
        )
    totals = evidence_for(s, INVOICE_TOTAL, ORDER_TOTAL)
    if order.currency != s.currency:
        return CheckResult(
            RULE,
            CheckOutcome.UNKNOWN,
            f"Faktura {s.currency}, sifariş {order.currency} ilə tərtib olunub. "
            "Valyuta avtomatik çevrilmir — qiymət müqayisəsi dayandırıldı.",
            totals,
            fix_hint=FixHint.UPLOAD_INVOICE,
        )
    order_units = {line.code: line.unit for line in order.lines}
    # lines missing from the order are R-005's finding; only shared lines are compared here
    shared = [
        (line.code, line.unit, order_units[line.code])
        for line in s.invoice.lines
        if line.code in order_units
    ]
    mismatches = [(c, inv, ord_) for c, inv, ord_ in shared if inv and ord_ and inv != ord_]
    unread = [
        (c, "faktura" if not inv else "sifariş") for c, inv, ord_ in shared if not inv or not ord_
    ]
    if mismatches:
        listed = "; ".join(
            f"{code} (faktura: {inv}, sifariş: {ord_})" for code, inv, ord_ in mismatches
        )
        return CheckResult(
            RULE,
            CheckOutcome.UNKNOWN,
            f"Ölçü vahidi fərqlidir: {listed}. "
            "Təsdiqlənmiş çevirmə qaydası olmadığı üçün qiymət müqayisəsi dayandırıldı.",
            totals,
            data={"unit_mismatch": [code for code, _, _ in mismatches]},
        )
    if unread:
        # an unread unit is never "units match": prices could be per box vs per piece
        listed = "; ".join(f"{code} ({where})" for code, where in unread)
        return CheckResult(
            RULE,
            CheckOutcome.UNKNOWN,
            f"Ölçü vahidi oxunmadı: {listed}. "
            "Vahid uyğunluğu təsdiqlənmədən qiymət müqayisəsi dayandırıldı.",
            totals,
            fix_hint=FixHint.EDIT_FIELD,
            data={"unit_unread": [code for code, _ in unread]},
        )
    return CheckResult(
        RULE, CheckOutcome.PASS, f"Valyuta ({s.currency}) və ölçü vahidləri uyğundur.", totals
    )
