import dataclasses
import uuid
from decimal import Decimal

import pytest

from payproof.domain.enums import Currency
from payproof.domain.money import Money
from payproof.domain.snapshot import InvoiceLine, Party, Rules
from tests.domain.builders import BUYER, azn, delivery, invoice, order, snapshot


def test_valid_snapshot_is_frozen() -> None:
    s = snapshot()
    assert s.invoice.lines[0].unit_price == azn("9.00")
    with pytest.raises(dataclasses.FrozenInstanceError):
        s.signature_reviewed = True  # type: ignore[misc]


def test_unread_values_are_none() -> None:
    # INV-1047 scan: PO not read, rules give UNKNOWN (never PASS)
    unread = invoice(
        po_ref=None,
        po_raw="PO-3?7",
        unreadable_fields=frozenset({"invoice.po_ref"}),
        lines=(InvoiceLine("X", None, None, None),),
        total=None,
    )
    snapshot(invoice=unread, order=None, candidates=("PO-377", "PO-371"), delivery=None)


def test_invoice_money_in_package_currency() -> None:
    usd_line = InvoiceLine("GY-1L", Decimal("1"), None, Money("9.00", Currency.USD))
    with pytest.raises(ValueError, match="currency"):
        snapshot(invoice=invoice(lines=(usd_line,)))


def test_order_prices_in_order_currency() -> None:
    with pytest.raises(ValueError, match="currency"):
        snapshot(order=order(currency=Currency.USD))


def test_line_codes_are_unique() -> None:
    line = InvoiceLine("GY-1L", Decimal("1"), None, azn("1.00"))
    with pytest.raises(ValueError, match="GY-1L"):
        snapshot(invoice=invoice(lines=(line, line)))


def test_every_referenced_customer_has_a_party() -> None:
    # R-003 names both buyers (INV-1046: delivery note for another buyer)
    stranger = uuid.uuid4()
    with pytest.raises(ValueError, match=str(stranger)):
        snapshot(delivery=delivery(customer_id=stranger))
    parties = {BUYER: Party("B", "1"), stranger: Party("C", "2")}
    s = snapshot(delivery=delivery(customer_id=stranger), parties=parties)
    assert s.parties[stranger].name == "C"


def test_confirmed_order_has_no_candidates() -> None:
    with pytest.raises(ValueError, match="candidates"):
        snapshot(candidates=("PO-382",))


@pytest.mark.parametrize("tolerance", ["-0.01", "1.01"])
def test_tolerance_range(tolerance: str) -> None:
    with pytest.raises(ValueError, match="tolerance"):
        Rules(True, True, True, Decimal(tolerance))
