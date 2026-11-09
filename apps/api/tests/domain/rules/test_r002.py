import pytest

from payproof.domain.enums import CheckOutcome as O
from payproof.domain.rules.r002 import r002
from payproof.domain.rules.result import FixHint
from tests.domain.builders import evidence, invoice, order, snapshot

UNREAD = frozenset({"invoice.po_ref"})


@pytest.mark.parametrize(
    ("candidates", "message"),
    [
        (("PO-377", "PO-371"), "2 mümkün sifariş tapıldı — düzgün sifarişi insan seçməlidir."),
        (("PO-381",), "Təklif olunan sifariş əlaqəsi hələ insan tərəfindən təsdiqlənməyib."),
        ((), "Təklif olunan sifariş əlaqəsi hələ insan tərəfindən təsdiqlənməyib."),
    ],
    ids=["many", "one", "none"],
)
def test_unconfirmed_order_is_unknown_and_asks_for_link(
    candidates: tuple[str, ...], message: str
) -> None:
    # INV-1048: two candidates, no automatic choice
    r = r002(snapshot(order=None, candidates=candidates))
    assert (r.outcome, r.message, r.fix_hint, r.cascade) == (
        O.UNKNOWN,
        message,
        FixHint.LINK_ORDER,
        False,
    )
    assert r.evidence == ()


def test_unread_po_is_cascade_unknown() -> None:
    r = r002(snapshot(invoice=invoice(po_ref=None, unreadable_fields=UNREAD)))
    assert (r.outcome, r.cascade, r.fix_hint) == (O.UNKNOWN, True, None)
    assert r.message == "Fakturadakı PO oxunmadığı üçün müqayisə aparılmır."


def test_no_po_is_not_applicable() -> None:
    r = r002(snapshot(invoice=invoice(po_ref=None)))
    assert (r.outcome, r.message) == (O.NOT_APPLICABLE, "Fakturada PO yoxdur — R-001-ə baxın.")


def test_other_po_fails() -> None:
    # INV-1043: invoice says PO-385, the confirmed order is PO-382
    r = r002(snapshot(invoice=invoice(po_ref="PO-385"), order=order(po="PO-382")))
    assert r.outcome is O.FAIL
    assert r.message == "Fakturadakı PO-385 təsdiqlənmiş sifarişə (PO-382) uyğun deyil."
    assert r.fix_hint is FixHint.UPLOAD_INVOICE
    assert r.evidence == (evidence("invoice.po_ref"), evidence("order.po_number"))


def test_matching_po_passes() -> None:
    r = r002(snapshot())
    assert (r.rule_id, r.outcome, r.message) == (
        "R-002",
        O.PASS,
        "PO-381 təsdiqlənmiş sifarişə uyğundur.",
    )
    assert r.evidence == (evidence("invoice.po_ref"), evidence("order.po_number"))
