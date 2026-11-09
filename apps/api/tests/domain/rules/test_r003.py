from payproof.domain.enums import CheckOutcome as O
from payproof.domain.rules.r003 import r003
from payproof.domain.rules.result import FixHint
from tests.domain.builders import OTHER, delivery, evidence, order, snapshot


def test_delivery_for_other_buyer_fails() -> None:
    # INV-1046: the delivery note names another buyer
    r = r003(snapshot(delivery=delivery(customer_id=OTHER)))
    assert r.outcome is O.FAIL
    assert r.message == (
        "Təhvil sənədi başqa alıcıya — C Restoran Qrupu — aid ola bilər. "
        "Faktura alıcısı: B Mağazalar Şəbəkəsi."
    )
    assert r.fix_hint is FixHint.UPLOAD_DELIVERY
    assert r.evidence == (evidence("invoice.customer"), evidence("delivery.customer"))


def test_order_for_other_buyer_fails_without_fix() -> None:
    r = r003(snapshot(order=order(customer_id=OTHER)))
    assert r.outcome is O.FAIL
    assert r.message == (
        "Sifariş başqa alıcıya — C Restoran Qrupu — aid ola bilər. "
        "Faktura alıcısı: B Mağazalar Şəbəkəsi."
    )
    assert (r.fix_hint, r.evidence) == (
        None,
        (evidence("invoice.customer"), evidence("order.customer")),
    )


def test_wrong_delivery_fails_even_without_order() -> None:
    r = r003(snapshot(order=None, delivery=delivery(customer_id=OTHER)))
    assert r.outcome is O.FAIL


def test_unread_delivery_buyer_is_unknown_not_pass() -> None:
    r = r003(snapshot(delivery=delivery(customer_id=None)))
    assert (r.outcome, r.cascade, r.fix_hint) == (O.UNKNOWN, False, FixHint.EDIT_FIELD)
    assert r.message == "Təhvil sənədində alıcı oxunmadı — tərəflərin uyğunluğu təsdiqlənmir."
    assert r.evidence == (evidence("delivery.customer"),)


def test_no_order_is_cascade_unknown() -> None:
    r = r003(snapshot(order=None))
    assert (r.outcome, r.cascade, r.evidence) == (O.UNKNOWN, True, ())
    assert r.message == "Sifariş təsdiqlənmədən tərəflər müqayisə olunmur."


def test_same_buyer_everywhere_passes() -> None:
    r = r003(snapshot())
    assert (r.rule_id, r.outcome, r.message) == (
        "R-003",
        O.PASS,
        "Alıcı (VÖEN 1402375611) bütün sənədlərdə eynidir.",
    )
    assert r.evidence == tuple(
        evidence(p) for p in ("invoice.customer", "order.customer", "delivery.customer")
    )


def test_passes_without_delivery() -> None:
    r = r003(snapshot(delivery=None))
    assert r.outcome is O.PASS
    assert r.evidence == (evidence("invoice.customer"), evidence("order.customer"))
