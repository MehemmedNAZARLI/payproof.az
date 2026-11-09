from decimal import Decimal

from payproof.domain.enums import CheckOutcome as O
from payproof.domain.enums import Currency
from payproof.domain.money import Money
from payproof.domain.rules.r004 import comparable, r004
from payproof.domain.rules.result import FixHint
from payproof.domain.snapshot import InvoiceLine, OrderLine
from tests.domain.builders import azn, evidence, invoice, order, snapshot

TOTALS = (evidence("invoice.total"), evidence("order.total"))


def test_no_order_is_cascade_unknown() -> None:
    r = r004(snapshot(order=None))
    assert (r.outcome, r.cascade, r.evidence) == (O.UNKNOWN, True, ())
    assert r.message == "Sifariş təsdiqlənmədən valyuta və vahid müqayisə olunmur."
    assert not comparable(r)


def test_other_currency_is_unknown_never_converted() -> None:
    # INV-1049 v1: invoice in USD, order in AZN
    usd = Currency.USD
    usd_invoice = invoice(
        lines=tuple(
            InvoiceLine(line.code, line.qty, line.unit, Money("5.00", usd))
            for line in invoice().lines
        ),
        total=Money("6000.00", usd),
    )
    r = r004(snapshot(currency=usd, invoice=usd_invoice))
    assert (r.outcome, r.cascade, r.fix_hint) == (O.UNKNOWN, False, FixHint.UPLOAD_INVOICE)
    assert r.message == (
        "Faktura USD, sifariş AZN ilə tərtib olunub. "
        "Valyuta avtomatik çevrilmir — qiymət müqayisəsi dayandırıldı."
    )
    assert r.evidence == TOTALS
    assert not comparable(r)


def test_unit_mismatch_is_unknown() -> None:
    # no approved unit conversion in P0
    inv = invoice(lines=(InvoiceLine("GY-1L", Decimal("800"), "qutu", azn("9.00")),))
    r = r004(snapshot(invoice=inv, delivery=None))
    assert (r.outcome, r.cascade, r.fix_hint) == (O.UNKNOWN, False, None)
    assert r.message == (
        "Ölçü vahidi fərqlidir: GY-1L (faktura: qutu, sifariş: ədəd). "
        "Təsdiqlənmiş çevirmə qaydası olmadığı üçün qiymət müqayisəsi dayandırıldı."
    )
    assert r.data == {"unit_mismatch": ["GY-1L"]}
    assert not comparable(r)


def test_unread_unit_is_unknown_not_pass() -> None:
    # a per-box price must never be compared with a per-piece price by accident
    inv = invoice(lines=(InvoiceLine("GY-1L", Decimal("800"), None, azn("9.00")),))
    o = order(lines=(OrderLine("GY-1L", Decimal("800"), "ədəd", azn("9.00")),))
    r = r004(snapshot(invoice=inv, order=o, delivery=None))
    assert (r.outcome, r.cascade, r.fix_hint) == (O.UNKNOWN, False, FixHint.EDIT_FIELD)
    assert r.message == (
        "Ölçü vahidi oxunmadı: GY-1L (faktura). "
        "Vahid uyğunluğu təsdiqlənmədən qiymət müqayisəsi dayandırıldı."
    )
    assert r.data == {"unit_unread": ["GY-1L"]}
    assert not comparable(r)


def test_unread_order_unit_is_unknown() -> None:
    o = order(lines=(OrderLine("GY-1L", Decimal("800"), None, azn("9.00")),))
    inv = invoice(lines=(InvoiceLine("GY-1L", Decimal("800"), "ədəd", azn("9.00")),))
    r = r004(snapshot(invoice=inv, order=o, delivery=None))
    assert (r.outcome, r.message.split(".")[0]) == (
        O.UNKNOWN,
        "Ölçü vahidi oxunmadı: GY-1L (sifariş)",
    )


def test_line_missing_from_order_is_left_to_r005() -> None:
    inv = invoice(lines=(*invoice().lines, InvoiceLine("KY-10", Decimal("1"), None, azn("1.00"))))
    assert r004(snapshot(invoice=inv)).outcome is O.PASS


def test_same_currency_and_units_pass() -> None:
    r = r004(snapshot())
    assert (r.rule_id, r.outcome, r.message) == (
        "R-004",
        O.PASS,
        "Valyuta (AZN) və ölçü vahidləri uyğundur.",
    )
    assert r.evidence == TOTALS
    assert comparable(r)


def test_order_line_units_compared_by_code() -> None:
    o = order(lines=(OrderLine("DY-5", Decimal("400"), "ədəd", azn("12.00")),))
    assert r004(snapshot(order=o)).outcome is O.PASS
