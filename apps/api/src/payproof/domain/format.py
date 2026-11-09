"""az-AZ display for rule messages; same output as api-client formatMoney / formatQuantity."""

from decimal import Decimal

from payproof.domain.money import Money

_MINUS = "−"  # U+2212, as in the prototype


def _group(digits: str) -> str:
    return f"{int(digits):,}".replace(",", ".")


def format_money(m: Money) -> str:
    """`12.000,00 AZN`; negative amounts get the typographic minus."""
    integer, frac = f"{abs(m.amount):.2f}".split(".")
    sign = _MINUS if m.amount < 0 else ""
    return f"{sign}{_group(integer)},{frac} {m.currency}"


def format_qty(qty: Decimal) -> str:
    """`1.200`, `12,5` — trailing fraction zeros dropped."""
    integer, _, frac = f"{qty:f}".partition(".")
    frac = frac.rstrip("0")
    return _group(integer) + (f",{frac}" if frac else "")
