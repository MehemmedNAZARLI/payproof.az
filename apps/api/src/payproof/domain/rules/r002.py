"""R-002 — the invoice PO matches the confirmed order. A suggested link is never enough."""

from payproof.domain.enums import CheckOutcome
from payproof.domain.rules.paths import INVOICE_PO, ORDER_PO
from payproof.domain.rules.r001 import po_unread
from payproof.domain.rules.result import CheckResult, FixHint, evidence_for
from payproof.domain.snapshot import PackageSnapshot

RULE = "R-002"


def r002(s: PackageSnapshot) -> CheckResult:
    po, order = s.invoice.po_ref, s.order
    if order is None:
        n = len(s.candidates)
        message = (
            f"{n} mümkün sifariş tapıldı — düzgün sifarişi insan seçməlidir."
            if n > 1
            else "Təklif olunan sifariş əlaqəsi hələ insan tərəfindən təsdiqlənməyib."
        )
        return CheckResult(RULE, CheckOutcome.UNKNOWN, message, fix_hint=FixHint.LINK_ORDER)
    if po_unread(s):
        return CheckResult(
            RULE,
            CheckOutcome.UNKNOWN,
            "Fakturadakı PO oxunmadığı üçün müqayisə aparılmır.",
            cascade=True,
        )
    if not po:
        return CheckResult(
            RULE, CheckOutcome.NOT_APPLICABLE, "Fakturada PO yoxdur — R-001-ə baxın."
        )
    ev = evidence_for(s, INVOICE_PO, ORDER_PO)
    if po != order.po:
        return CheckResult(
            RULE,
            CheckOutcome.FAIL,
            f"Fakturadakı {po} təsdiqlənmiş sifarişə ({order.po}) uyğun deyil.",
            ev,
            fix_hint=FixHint.UPLOAD_INVOICE,
        )
    return CheckResult(RULE, CheckOutcome.PASS, f"{po} təsdiqlənmiş sifarişə uyğundur.", ev)
