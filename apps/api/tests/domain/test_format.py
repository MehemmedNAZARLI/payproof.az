from decimal import Decimal

import pytest

from payproof.domain.enums import Currency
from payproof.domain.format import format_money, format_qty
from payproof.domain.money import Money


@pytest.mark.parametrize(
    ("amount", "text"),
    [
        ("12000.00", "12.000,00 AZN"),
        ("9.5", "9,50 AZN"),
        ("0", "0,00 AZN"),
        ("-500.00", "−500,00 AZN"),
        ("1234567.89", "1.234.567,89 AZN"),
    ],
)
def test_money_like_the_prototype(amount: str, text: str) -> None:
    assert format_money(Money(amount, Currency.AZN)) == text


@pytest.mark.parametrize(
    ("qty", "text"),
    [("1200", "1.200"), ("12.500", "12,5"), ("0.125", "0,125"), ("800", "800"), ("7.000", "7")],
)
def test_quantity_like_the_prototype(qty: str, text: str) -> None:
    assert format_qty(Decimal(qty)) == text
