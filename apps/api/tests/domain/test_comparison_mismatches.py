from decimal import Decimal

from payproof.domain.enums import Currency
from payproof.domain.money import Money
from payproof.domain.snapshot import DeliveryLine, InvoiceLine
from tests.domain.builders import OTHER, azn, delivery, invoice
from tests.domain.test_comparison import _rows


def test_line_labels() -> None:
    rows = _rows()
    assert rows["lines[GY-1L].qty"]["label"] == "Miqdar (ədəd)"
    assert rows["lines[DY-5].qty"]["group"] == "DY-5 · DY-5"  # no description known


def test_unread_po_and_missing_order() -> None:
    inv = invoice(po_ref=None, po_raw="PO-3?7", unreadable_fields=frozenset({"invoice.po_ref"}))
    rows = _rows(invoice=inv, order=None, delivery=None)
    assert rows["po_ref"]["invoice"]["state"] == "unknown"
    assert rows["po_ref"]["order"]["state"] == "empty"


def test_mismatches() -> None:
    inv = invoice(
        lines=(InvoiceLine("GY-1L", Decimal("700"), "ədəd", azn("9.50")),), total=azn("6650.00")
    )
    rows = _rows(
        invoice=inv,
        delivery=delivery(customer_id=OTHER, lines=(DeliveryLine("GY-1L", Decimal("800")),)),
    )
    assert rows["lines[GY-1L].qty"]["invoice"]["state"] == "mismatch"
    assert rows["lines[GY-1L].qty"]["delivery"]["state"] == "mismatch"
    assert rows["lines[GY-1L].unit_price"]["invoice"]["state"] == "mismatch"
    assert rows["customer"]["delivery"]["state"] == "mismatch"


def test_other_currency_order_is_unknown_not_mismatch() -> None:
    usd = Currency.USD
    inv = invoice(
        lines=(InvoiceLine("GY-1L", Decimal("800"), "ədəd", Money("2.00", usd)),),
        total=Money("1600.00", usd),
    )
    rows = _rows(currency=usd, invoice=inv, delivery=None)
    assert rows["currency"]["order"]["state"] == "unknown"
    price = rows["lines[GY-1L].unit_price"]
    assert (price["invoice"]["state"], price["order"]["state"], price["order"]["currency"]) == (
        "ok",
        "unknown",
        "AZN",
    )
