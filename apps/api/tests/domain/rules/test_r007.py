import pytest

from payproof.domain.enums import CheckOutcome as O
from payproof.domain.rules.r007 import r007
from payproof.domain.rules.result import FixHint
from tests.domain.builders import delivery, evidence, rules, snapshot


@pytest.mark.parametrize(
    ("require_signature", "text"), [(False, ""), (True, "imzalanmış ")], ids=["plain", "signed"]
)
def test_missing_delivery_fails(require_signature: bool, text: str) -> None:
    # INV-1042 v1 / INV-1052: no delivery note in the package
    r = r007(snapshot(delivery=None, rules=rules(require_signature=require_signature)))
    assert (r.outcome, r.fix_hint) == (O.FAIL, FixHint.UPLOAD_DELIVERY)
    assert r.message == (
        f"Müştəri qaydası {text}təhvil sənədi tələb edir; paketdə təhvil sənədi yoxdur."
    )


def test_branches() -> None:
    na = r007(snapshot(rules=rules(require_delivery=False), delivery=None))
    assert (na.outcome, na.message) == (
        O.NOT_APPLICABLE,
        "Müştəri qaydası təhvil sənədi tələb etmir.",
    )
    no_order = r007(snapshot(order=None))
    assert (no_order.outcome, no_order.cascade) == (O.UNKNOWN, True)
    assert no_order.message == "Sifariş təsdiqlənmədən təhvil sənədinin bağlılığı yoxlanmır."
    ok = r007(snapshot())
    assert (ok.outcome, ok.message) == (O.PASS, "TS-5531 paketdədir və PO-381 sifarişinə bağlıdır.")
    assert ok.evidence == (evidence("delivery.po_ref"),)


def test_delivery_for_other_order_is_unknown() -> None:
    # INV-1048: TS-5541 refers to PO-384
    r = r007(snapshot(delivery=delivery(no="TS-5541", po_ref="PO-384")))
    assert (r.outcome, r.cascade, r.fix_hint) == (O.UNKNOWN, False, FixHint.UPLOAD_DELIVERY)
    assert r.message == (
        "TS-5541 sənədində sifariş: PO-384; təsdiqlənmiş sifariş: PO-381. Uyğunluq təsdiqlənməyib."
    )
    assert r.evidence == (evidence("delivery.po_ref"), evidence("order.po_number"))


def test_unread_delivery_po_is_unknown() -> None:
    r = r007(snapshot(delivery=delivery(po_ref=None)))
    assert (r.outcome, r.fix_hint) == (O.UNKNOWN, FixHint.EDIT_FIELD)
    assert r.message == "TS-5531 sənədində sifariş nömrəsi oxunmadı. Uyğunluq təsdiqlənməyib."
