"""R-008 — the delivery note is signed, confirmed visually by a person (not legal proof)."""

from payproof.domain.enums import CheckOutcome
from payproof.domain.rules.paths import DELIVERY_SIGNATURE
from payproof.domain.rules.result import CheckResult, FixHint, evidence_for
from payproof.domain.snapshot import PackageSnapshot

RULE = "R-008"


def r008(s: PackageSnapshot, *, r007_result: CheckResult) -> CheckResult:
    dl = s.delivery
    if not s.rules.require_signature:
        return CheckResult(RULE, CheckOutcome.NOT_APPLICABLE, "Müştəri qaydası imza tələb etmir.")
    if dl is None:
        return CheckResult(
            RULE,
            CheckOutcome.NOT_APPLICABLE,
            "Təhvil sənədi olmadan imza yoxlanmır — R-007-yə baxın.",
        )
    if r007_result.outcome is not CheckOutcome.PASS:
        return CheckResult(
            RULE,
            CheckOutcome.UNKNOWN,
            "Təhvil sənədinin uyğunluğu təsdiqlənmədən imza yoxlanmır.",
            cascade=True,
        )
    ev = evidence_for(s, DELIVERY_SIGNATURE)
    if dl.signed is False:  # None = not read: a person decides, like a present signature
        return CheckResult(
            RULE,
            CheckOutcome.FAIL,
            "Təhvil aktında qəbul edənin imza sahəsi boşdur.",
            ev,
            fix_hint=FixHint.UPLOAD_DELIVERY,
        )
    if not s.signature_reviewed:
        return CheckResult(
            RULE,
            CheckOutcome.UNKNOWN,
            "İmza tələb olunur: əməkdaş sənədə baxıb imzanın mövcudluğunu təsdiqləməlidir.",
            ev,
            fix_hint=FixHint.REVIEW_SIGNATURE,
        )
    return CheckResult(
        RULE,
        CheckOutcome.PASS,
        "Əməkdaş imzanın vizual mövcudluğunu təsdiqləyib. "
        "Bu, imzanın hüquqi autentifikasiyası deyil.",
        ev,
    )
