import pytest

from payproof.domain.enums import CheckOutcome as O
from payproof.domain.rules.r007 import r007
from payproof.domain.rules.r008 import r008
from payproof.domain.rules.result import CheckResult, FixHint
from payproof.domain.snapshot import PackageSnapshot
from tests.domain.builders import delivery, evidence, rules, snapshot

SIGNED = rules(require_signature=True)


def _r008(s: PackageSnapshot) -> CheckResult:
    return r008(s, r007_result=r007(s))


def test_not_applicable() -> None:
    off = _r008(snapshot())
    assert (off.outcome, off.message) == (O.NOT_APPLICABLE, "Müştəri qaydası imza tələb etmir.")
    no_dl = _r008(snapshot(rules=SIGNED, delivery=None))
    assert (no_dl.outcome, no_dl.message) == (
        O.NOT_APPLICABLE,
        "Təhvil sənədi olmadan imza yoxlanmır — R-007-yə baxın.",
    )


def test_waits_for_r007() -> None:
    r = _r008(snapshot(rules=SIGNED, delivery=delivery(po_ref="PO-384")))
    assert (r.outcome, r.cascade) == (O.UNKNOWN, True)
    assert r.message == "Təhvil sənədinin uyğunluğu təsdiqlənmədən imza yoxlanmır."


def test_empty_signature_fails() -> None:
    r = _r008(snapshot(rules=SIGNED, delivery=delivery(signed=False)))
    assert (r.outcome, r.fix_hint) == (O.FAIL, FixHint.UPLOAD_DELIVERY)
    assert r.message == "Təhvil aktında qəbul edənin imza sahəsi boşdur."
    assert r.evidence == (evidence("delivery.signed"),)


@pytest.mark.parametrize("signed", [True, None], ids=["signed", "unread"])
def test_needs_human_review(signed: bool | None) -> None:
    # INV-1042 after uploading TS-5531_imzali.pdf; an unread field also goes to a human
    r = _r008(snapshot(rules=SIGNED, delivery=delivery(signed=signed)))
    assert (r.outcome, r.cascade, r.fix_hint) == (O.UNKNOWN, False, FixHint.REVIEW_SIGNATURE)
    assert r.message == (
        "İmza tələb olunur: əməkdaş sənədə baxıb imzanın mövcudluğunu təsdiqləməlidir."
    )


def test_reviewed_signature_passes_but_is_not_legal_proof() -> None:
    r = _r008(snapshot(rules=SIGNED, signature_reviewed=True))
    assert (r.rule_id, r.outcome) == ("R-008", O.PASS)
    assert r.message == (
        "Əməkdaş imzanın vizual mövcudluğunu təsdiqləyib. "
        "Bu, imzanın hüquqi autentifikasiyası deyil."
    )
