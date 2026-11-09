"""R-007 — the delivery note is in the package and refers to the confirmed order."""

from payproof.domain.enums import CheckOutcome
from payproof.domain.rules.paths import DELIVERY_PO, ORDER_PO
from payproof.domain.rules.result import CheckResult, FixHint, evidence_for
from payproof.domain.snapshot import PackageSnapshot

RULE = "R-007"


def r007(s: PackageSnapshot) -> CheckResult:
    dl, order = s.delivery, s.order
    if not s.rules.require_delivery:
        return CheckResult(
            RULE, CheckOutcome.NOT_APPLICABLE, "Müştəri qaydası təhvil sənədi tələb etmir."
        )
    if dl is None:
        signed = "imzalanmış " if s.rules.require_signature else ""
        return CheckResult(
            RULE,
            CheckOutcome.FAIL,
            f"Müştəri qaydası {signed}təhvil sənədi tələb edir; paketdə təhvil sənədi yoxdur.",
            fix_hint=FixHint.UPLOAD_DELIVERY,
        )
    if order is None:
        return CheckResult(
            RULE,
            CheckOutcome.UNKNOWN,
            "Sifariş təsdiqlənmədən təhvil sənədinin bağlılığı yoxlanmır.",
            cascade=True,
        )
    note = dl.no or "Təhvil"
    if dl.po_ref is None:
        # not in the rules table: an unread PO on the note is never "linked"
        return CheckResult(
            RULE,
            CheckOutcome.UNKNOWN,
            f"{note} sənədində sifariş nömrəsi oxunmadı. Uyğunluq təsdiqlənməyib.",
            evidence_for(s, DELIVERY_PO),
            fix_hint=FixHint.EDIT_FIELD,
        )
    if dl.po_ref != order.po:
        return CheckResult(
            RULE,
            CheckOutcome.UNKNOWN,
            f"{note} sənədində sifariş: {dl.po_ref}; təsdiqlənmiş sifariş: {order.po}. "
            "Uyğunluq təsdiqlənməyib.",
            evidence_for(s, DELIVERY_PO, ORDER_PO),
            fix_hint=FixHint.UPLOAD_DELIVERY,
        )
    return CheckResult(
        RULE,
        CheckOutcome.PASS,
        f"{note} paketdədir və {order.po} sifarişinə bağlıdır.",
        evidence_for(s, DELIVERY_PO),
    )
