"""R-001 — the invoice carries the PO number when the customer requires it."""

from payproof.domain.enums import CheckOutcome
from payproof.domain.rules.paths import INVOICE_PO
from payproof.domain.rules.result import CheckResult, FixHint, evidence_for
from payproof.domain.snapshot import PackageSnapshot

RULE = "R-001"


def po_unread(s: PackageSnapshot) -> bool:
    return INVOICE_PO in s.invoice.unreadable_fields


def r001(s: PackageSnapshot) -> CheckResult:
    po = s.invoice.po_ref
    ev = evidence_for(s, INVOICE_PO)
    if not s.rules.require_po:
        return CheckResult(
            RULE, CheckOutcome.NOT_APPLICABLE, "Müştəri qaydası sifariş nömrəsini tələb etmir."
        )
    if po_unread(s):
        return CheckResult(
            RULE,
            CheckOutcome.UNKNOWN,
            "PO sahəsi skanda oxunmadı. Mənbəyə baxıb sahəni təsdiqləyin "
            "və ya müştəridən aydın nüsxə istəyin.",
            ev,
            fix_hint=FixHint.EDIT_FIELD,
        )
    if not po:
        return CheckResult(
            RULE,
            CheckOutcome.FAIL,
            "Müştəri qaydası fakturada sifariş nömrəsi tələb edir, fakturada isə PO göstərilməyib.",
            ev,
            fix_hint=FixHint.UPLOAD_INVOICE,
        )
    return CheckResult(RULE, CheckOutcome.PASS, f"Fakturada sifariş nömrəsi var: {po}.", ev)
