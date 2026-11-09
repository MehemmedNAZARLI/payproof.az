import datetime as dt
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.models import Order, OrderLine
from tests.integration.factories import Tenant, add, add_fails


def _order(t: Tenant, po: str = "PO-381", **over: object) -> Order:
    fields: dict[str, object] = {
        "customer_id": t.customer.id,
        "po_number": po,
        "currency": "AZN",
        "order_date": dt.date(2026, 10, 28),
    }
    fields.update(over)
    return Order(company_id=t.company.id, **fields)


def _line(order: Order, code: str = "GY-1L", **over: object) -> OrderLine:
    fields: dict[str, object] = {
        "product_code": code,
        "qty": Decimal("800"),
        "unit": "ədəd",
        "unit_price": Decimal("9.00"),
    }
    fields.update(over)
    return OrderLine(company_id=order.company_id, order_id=order.id, **fields)


async def test_order_with_lines(db: AsyncSession, a: Tenant) -> None:
    order = _order(a)
    await add(db, order)
    await add(db, _line(order), _line(order, "DY-5", description=None, unit=None))


async def test_po_number_unique_per_company(db: AsyncSession, a: Tenant, b: Tenant) -> None:
    await add(db, _order(a), _order(b))
    await add_fails(db, _order(a))


async def test_order_customer_must_be_same_tenant(db: AsyncSession, a: Tenant, b: Tenant) -> None:
    await add_fails(db, _order(a, customer_id=b.customer.id))


async def test_currency_is_azn_or_usd(db: AsyncSession, a: Tenant) -> None:
    await add_fails(db, _order(a, currency="EUR"))


async def test_line_order_must_be_same_tenant(db: AsyncSession, a: Tenant, b: Tenant) -> None:
    order = _order(a)
    await add(db, order)
    line = _line(order)
    line.company_id = b.company.id
    await add_fails(db, line)


async def test_one_line_per_product(db: AsyncSession, a: Tenant) -> None:
    order = _order(a)
    await add(db, order)
    await add(db, _line(order))
    await add_fails(db, _line(order))


@pytest.mark.parametrize(
    "over", [{"qty": Decimal("0")}, {"unit_price": Decimal("-0.01")}], ids=["qty", "price"]
)
async def test_line_amounts(db: AsyncSession, a: Tenant, over: dict[str, object]) -> None:
    order = _order(a)
    await add(db, order)
    line = _line(order)
    for name, value in over.items():
        setattr(line, name, value)
    await add_fails(db, line)
