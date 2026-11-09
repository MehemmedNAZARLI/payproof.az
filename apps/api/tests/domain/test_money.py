from decimal import Decimal

import pytest

from payproof.domain.enums import Currency
from payproof.domain.money import MixedCurrencyError, Money

AZN, USD = Currency.AZN, Currency.USD


def azn(amount: str) -> Money:
    return Money(amount, AZN)


def test_decimal_addition_is_exact() -> None:
    assert azn("0.1") + azn("0.2") == azn("0.3")


def test_mixed_currencies_never_combine() -> None:
    with pytest.raises(MixedCurrencyError):
        azn("1.00") + Money("1.00", USD)
    with pytest.raises(MixedCurrencyError):
        _ = azn("1.00") < Money("2.00", USD)
    assert azn("1.00") != Money("1.00", USD)


@pytest.mark.parametrize("bad", [0.1, "abc", "NaN", "Infinity", None])
def test_rejects_float_and_non_numbers(bad: object) -> None:
    with pytest.raises((TypeError, ValueError)):
        Money(bad, AZN)  # type: ignore[arg-type]


@pytest.mark.parametrize("huge", ["1e30", Decimal("1e30"), "1e16", "-10000000000000000"])
def test_rejects_amounts_beyond_numeric_18_2(huge: object) -> None:
    # parser / manual correction input must fail as ValueError (422), not 500
    with pytest.raises(ValueError, match="range"):
        Money(huge, AZN)  # type: ignore[arg-type]


def test_largest_storable_amount() -> None:
    assert str(azn("9999999999999999.99")) == "9999999999999999.99"


def test_currency_is_required_and_known() -> None:
    with pytest.raises(ValueError):
        Money("1.00", "EUR")  # type: ignore[arg-type]


@pytest.mark.parametrize(
    ("raw", "rounded"), [("1.005", "1.01"), ("2.345", "2.35"), ("-1.005", "-1.01"), ("7", "7.00")]
)
def test_rounds_half_up_to_two_places(raw: str, rounded: str) -> None:
    assert str(azn(raw).amount) == rounded


def test_api_string() -> None:
    assert str(azn("12000")) == "12000.00"


def test_price_times_quantity() -> None:
    # R-005 example (INV-1044): (110.00 - 100.00) x 50 = 500.00
    diff = (azn("110.00") - azn("100.00")) * Decimal("50")
    assert diff == azn("500.00")
    assert azn("9.00") * Decimal("0.333") == azn("3.00")
    with pytest.raises(TypeError):
        azn("1.00") * 1.5  # type: ignore[operator]


def test_tolerance_comparison() -> None:
    # R-009: abs(sum - total) <= tolerance
    assert abs(azn("11999.99") - azn("12000.00")) <= azn("0.01")
    assert not abs(azn("11999.98") - azn("12000.00")) <= azn("0.01")


def test_sum_needs_currency_and_is_zero_when_empty() -> None:
    assert Money.sum([], AZN) == azn("0")
    assert Money.sum([azn("1.10"), azn("2.20")], AZN) == azn("3.30")
    with pytest.raises(MixedCurrencyError):
        Money.sum([Money("1", USD)], AZN)


def test_is_immutable_and_hashable() -> None:
    m = azn("1")
    with pytest.raises(AttributeError):
        m.amount = Decimal("2")
    assert {m, azn("1.00")} == {m}
