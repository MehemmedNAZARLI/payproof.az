import datetime as dt
from dataclasses import dataclass
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.models import Company, Customer, Membership, RequirementSet, User


@dataclass
class Ctx:
    a: Company
    b: Company
    approver: User


@pytest.fixture
async def ctx(db: AsyncSession) -> Ctx:
    a, b = Company(name="A", voen="1700123451"), Company(name="B", voen="1700123452")
    approver = User(email="rashad@a.test", full_name="Rəşad Əliyev", title="Maliyyə direktoru")
    db.add_all([a, b, approver])
    await db.flush()
    db.add(Membership(user_id=approver.id, company_id=a.id, role="approver"))
    await db.flush()
    return Ctx(a, b, approver)


def _customer(company: Company, external_id: str = "BMS-001") -> Customer:
    return Customer(
        company_id=company.id, name="B Mağazalar", external_id=external_id, voen="1402375611"
    )


def _rules(customer: Customer, approver: User, **over: object) -> RequirementSet:
    fields: dict[str, object] = {
        "version": 1,
        "require_po": True,
        "require_delivery": True,
        "require_signature": False,
        "tolerance": Decimal("0.01"),
        "effective_from": dt.date(2026, 6, 1),
        "approved_by": approver.id,
        "reason": "İlk qayda dəsti",
    }
    fields.update(over)
    return RequirementSet(company_id=customer.company_id, customer_id=customer.id, **fields)


async def _add(db: AsyncSession, *objs: object) -> None:
    db.add_all(objs)
    await db.flush()


async def _fails(db: AsyncSession, *objs: object) -> None:
    with pytest.raises(IntegrityError):
        await _add(db, *objs)


async def test_external_id_unique_per_company(db: AsyncSession, ctx: Ctx) -> None:
    await _add(db, _customer(ctx.a), _customer(ctx.b))  # same id in another tenant is fine
    await _fails(db, _customer(ctx.a))


async def test_requirement_set_versions_are_unique(db: AsyncSession, ctx: Ctx) -> None:
    customer = _customer(ctx.a)
    await _add(db, customer)
    await _add(db, _rules(customer, ctx.approver), _rules(customer, ctx.approver, version=2))
    await _fails(db, _rules(customer, ctx.approver, version=2))


async def test_requirement_set_customer_must_be_same_tenant(db: AsyncSession, ctx: Ctx) -> None:
    customer = _customer(ctx.a)
    await _add(db, customer)
    rules = _rules(customer, ctx.approver)
    rules.company_id = ctx.b.id
    await _fails(db, rules)


async def test_approver_must_be_member_of_the_tenant(db: AsyncSession, ctx: Ctx) -> None:
    outsider = User(email="other@b.test", full_name="Başqa", title="Direktor")
    await _add(db, outsider)
    await _add(db, Membership(user_id=outsider.id, company_id=ctx.b.id, role="approver"))
    customer = _customer(ctx.a)
    await _add(db, customer)
    await _fails(db, _rules(customer, outsider))


@pytest.mark.parametrize("tolerance", ["-0.01", "1.01"])
async def test_tolerance_range(db: AsyncSession, ctx: Ctx, tolerance: str) -> None:
    customer = _customer(ctx.a)
    await _add(db, customer)
    await _fails(db, _rules(customer, ctx.approver, tolerance=Decimal(tolerance)))


async def test_requirement_set_is_immutable(db: AsyncSession, ctx: Ctx) -> None:
    customer = _customer(ctx.a)
    await _add(db, customer)
    rules = _rules(customer, ctx.approver)
    await _add(db, rules)
    rules.require_signature = True
    with pytest.raises(IntegrityError):
        await db.flush()


async def test_requirement_set_cannot_be_deleted(db: AsyncSession, ctx: Ctx) -> None:
    customer = _customer(ctx.a)
    await _add(db, customer)
    rules = _rules(customer, ctx.approver)
    await _add(db, rules)
    await db.delete(rules)
    with pytest.raises(IntegrityError):
        await db.flush()
