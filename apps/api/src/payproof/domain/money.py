"""Money value object (ADR-0006): Decimal only, ROUND_HALF_UP, never mixes currencies."""

from collections.abc import Iterable
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Self

from payproof.domain.enums import Currency

# minor-unit precision per currency (both 2 today; a new currency must declare its own)
_QUANTUM = {Currency.AZN: Decimal("0.01"), Currency.USD: Decimal("0.01")}
_LIMIT = Decimal(10) ** 16  # DB column NUMERIC(18,2): 16 integer digits


class MixedCurrencyError(ValueError):
    """AZN and USD are never summed, compared or converted."""


def _check_range(value: Decimal, raw: object) -> None:
    if abs(value) >= _LIMIT:
        raise ValueError(f"money amount out of range (NUMERIC(18,2)): {raw!r}")


class Money:
    __slots__ = ("amount", "currency")
    amount: Decimal
    currency: Currency

    def __init__(self, amount: Decimal | str | int, currency: Currency) -> None:
        if isinstance(amount, bool) or not isinstance(amount, Decimal | str | int):
            raise TypeError(
                f"money amount must be Decimal, str or int, not {type(amount).__name__}"
            )
        try:
            value = Decimal(amount)
        except InvalidOperation:
            raise ValueError(f"not a money amount: {amount!r}") from None
        if not value.is_finite():
            raise ValueError(f"not a money amount: {amount!r}")
        currency = Currency(currency)  # ValueError for unknown codes
        _check_range(value, amount)  # before quantize: a huge exponent overflows the context
        value = value.quantize(_QUANTUM[currency], ROUND_HALF_UP)
        _check_range(value, amount)  # after: 9999999999999999.995 rounds up to the limit
        object.__setattr__(self, "currency", currency)
        object.__setattr__(self, "amount", value)

    def __setattr__(self, name: str, value: object) -> None:
        raise AttributeError("Money is immutable")

    @classmethod
    def sum(cls, items: Iterable[Self], currency: Currency) -> Self:
        """Explicit currency, so an empty sum is still a typed zero."""
        total = cls(0, currency)
        for item in items:
            total = total + item
        return total

    def _check(self, other: "Money") -> None:
        if other.currency != self.currency:
            raise MixedCurrencyError(f"{self.currency} and {other.currency} cannot be combined")

    def __add__(self, other: Self) -> Self:
        self._check(other)
        return type(self)(self.amount + other.amount, self.currency)

    def __sub__(self, other: Self) -> Self:
        self._check(other)
        return type(self)(self.amount - other.amount, self.currency)

    def __mul__(self, factor: Decimal | int) -> Self:
        """Price x quantity; the result is rounded to the currency's minor unit."""
        if isinstance(factor, bool) or not isinstance(factor, Decimal | int):
            raise TypeError(f"money can only be multiplied by Decimal or int, not {factor!r}")
        return type(self)(self.amount * factor, self.currency)

    def __neg__(self) -> Self:
        return type(self)(-self.amount, self.currency)

    def __abs__(self) -> Self:
        return type(self)(abs(self.amount), self.currency)

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Money):
            return NotImplemented
        return (self.amount, self.currency) == (other.amount, other.currency)

    def __lt__(self, other: Self) -> bool:
        self._check(other)
        return self.amount < other.amount

    def __le__(self, other: Self) -> bool:  # > and >= come from reflection
        self._check(other)
        return self.amount <= other.amount

    def __hash__(self) -> int:
        return hash((self.amount, self.currency))

    def __str__(self) -> str:
        """API form: plain amount string ("12000.00"); currency travels separately."""
        return str(self.amount)

    def __repr__(self) -> str:
        return f"Money('{self.amount}', {self.currency})"
