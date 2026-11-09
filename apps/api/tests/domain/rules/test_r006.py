from decimal import Decimal

from payproof.domain.enums import CheckOutcome as O
from payproof.domain.rules.paths import line
from payproof.domain.rules.r006 import r006
from payproof.domain.rules.result import FixHint
from payproof.domain.snapshot import DeliveryLine, InvoiceLine, OrderLine
from tests.domain.builders import OTHER, azn, delivery, evidence, invoice, order, snapshot

BOTH = (DeliveryLine("GY-1L", Decimal("800")), DeliveryLine("DY-5", Decimal("400")))


def test_not_comparable_is_cascade_unknown() -> None:
    r = r006(snapshot(), comparable=False)
    assert (r.outcome, r.cascade) == (O.UNKNOWN, True)
    assert (
        r.message == "Miqdar müqayisəsi sifariş və vahid uyğunluğu təsdiqləndikdən sonra aparılır."
    )


def test_invoice_vs_order_quantity_fails() -> None:
    o = order(lines=(OrderLine("GY-1L", Decimal("700"), "ədəd", azn("9.00")), order().lines[1]))
    paths = (line("invoice", "GY-1L", "qty"), line("order", "GY-1L", "qty"))
    s = snapshot(order=o, delivery=None, evidence={p: evidence(p) for p in paths})
    r = r006(s, comparable=True)
    assert r.outcome is O.FAIL
    assert r.message == (
        "GY-1L: fakturada 800, sifarişdə 700 ədəd. "
        "Qismən çatdırılma P0-da avtomatik uyğun sayılmır."
    )
    assert (r.fix_hint, r.evidence) == (FixHint.UPLOAD_INVOICE, tuple(evidence(p) for p in paths))


def test_invoice_vs_delivery_quantity_fails() -> None:
    # INV-1045: partial delivery; a missing delivery line counts as 0
    d = delivery(lines=(DeliveryLine("GY-1L", Decimal("1200")),))
    one = snapshot(
        invoice=invoice(lines=invoice().lines[:1]), order=order(lines=order().lines[:1]), delivery=d
    )
    r = r006(one, comparable=True)
    assert r.message == (
        "GY-1L: fakturada 800, təhvil aktında 1.200 ədəd. "
        "Qismən çatdırılma P0-da avtomatik uyğun sayılmır."
    )
    r = r006(snapshot(delivery=delivery(lines=BOTH[:1])), comparable=True)
    assert r.message.startswith("DY-5: fakturada 400, təhvil aktında 0 ədəd.")


def test_unlinked_delivery_is_not_compared() -> None:
    for d in (delivery(po_ref="PO-999", lines=()), delivery(customer_id=OTHER, lines=())):
        r = r006(snapshot(delivery=d), comparable=True)
        assert r.outcome is O.PASS
        assert r.message == (
            "Faktura və sifariş miqdarları uyğundur; uyğun təhvil sənədi olmadığı üçün "
            "təhvil miqdarı müqayisə edilmədi."
        )


def test_unread_quantity_is_unknown_not_pass() -> None:
    lines = (InvoiceLine("GY-1L", None, "ədəd", azn("9.00")), invoice().lines[1])
    r = r006(snapshot(invoice=invoice(lines=lines)), comparable=True)
    assert (r.outcome, r.fix_hint) == (O.UNKNOWN, FixHint.EDIT_FIELD)
    assert r.message == "Miqdar oxunmadı: GY-1L. Mənbəyə baxıb sahəni təsdiqləyin."
    unread_dl = delivery(lines=(DeliveryLine("GY-1L", None), BOTH[1]))
    assert r006(snapshot(delivery=unread_dl), comparable=True).outcome is O.UNKNOWN


def test_all_quantities_match() -> None:
    paths = (line("invoice", "GY-1L", "qty"), line("delivery", "GY-1L", "qty"))
    s = snapshot(delivery=delivery(lines=BOTH), evidence={p: evidence(p) for p in paths})
    r = r006(s, comparable=True)
    assert (r.rule_id, r.outcome, r.message) == (
        "R-006",
        O.PASS,
        "Sifariş, faktura və təhvil miqdarları uyğundur.",
    )
    assert r.evidence == tuple(evidence(p) for p in paths)
