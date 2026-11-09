import datetime as dt
from dataclasses import dataclass
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.base import bind_tenant
from payproof.repositories.customers import CustomerRepository, RequirementSetRepository
from payproof.repositories.identity import MembershipRepository, UserRepository
from payproof.repositories.models import Company, Customer, Membership, RequirementSet, User


@dataclass
class World:
    a: Company
    b: Company
    user: User
    a_customer: Customer
    b_customer: Customer


def _rules(customer: Customer, user: User, version: int) -> RequirementSet:
    return RequirementSet(
        company_id=customer.company_id,
        customer_id=customer.id,
        version=version,
        require_po=True,
        require_delivery=True,
        require_signature=version > 1,
        tolerance=Decimal("0.01"),
        effective_from=dt.date(2026, 6, version),
        approved_by=user.id,
        reason=f"v{version}",
    )


@pytest.fixture
async def world(db: AsyncSession) -> World:
    a, b = Company(name="A", voen="1700123451"), Company(name="B", voen="1700123452")
    user = User(email="aygun@a.test", full_name="Aygün Məmmədova", title="Maliyyə əməkdaşı")
    db.add_all([a, b, user])
    await db.flush()
    a_customer = Customer(company_id=a.id, name="BMS", external_id="BMS-001", voen="1402375611")
    b_customer = Customer(company_id=b.id, name="X", external_id="X-001", voen="1402375612")
    db.add_all(
        [
            a_customer,
            b_customer,
            Membership(user_id=user.id, company_id=a.id, role="operator"),
            Membership(user_id=user.id, company_id=b.id, role="approver", active=False),
        ]
    )
    await db.flush()
    db.add_all(
        [_rules(a_customer, user, 1), _rules(a_customer, user, 2), _rules(b_customer, user, 1)]
    )
    await db.flush()
    return World(a, b, user, a_customer, b_customer)


async def test_user_by_email_ignores_case(db: AsyncSession, world: World) -> None:
    found = await UserRepository(db).by_email("  Aygun@A.TEST ")
    assert found is not None and found.id == world.user.id
    assert await UserRepository(db).by_email("nobody@a.test") is None


async def test_active_membership_only_for_own_company(db: AsyncSession, world: World) -> None:
    repo = MembershipRepository(db)
    membership = await repo.active(world.user.id, world.a.id)
    assert membership is not None and membership.role == "operator"
    assert await repo.active(world.user.id, world.b.id) is None


async def test_inactive_membership_is_ignored(db: AsyncSession, world: World) -> None:
    membership = await MembershipRepository(db).active(world.user.id, world.a.id)
    assert membership is not None
    membership.active = False
    await db.flush()
    assert await MembershipRepository(db).active(world.user.id, world.a.id) is None


async def test_sign_in_needs_exactly_one_login_membership(db: AsyncSession, world: World) -> None:
    repo = MembershipRepository(db)
    signed_in = await repo.sign_in(world.user.id)
    assert signed_in is not None and signed_in.company_id == world.a.id
    # shortcut under test: with two active login memberships no tenant is guessed
    in_b = await db.scalar(
        select(Membership).where(
            Membership.user_id == world.user.id, Membership.company_id == world.b.id
        )
    )
    assert in_b is not None
    in_b.active = True
    await db.flush()
    assert await repo.sign_in(world.user.id) is None


async def test_customer_of_other_tenant_is_not_found(db: AsyncSession, world: World) -> None:
    bind_tenant(db, world.a.id)
    repo = CustomerRepository(db)
    assert await repo.get(world.a_customer.id) is not None
    assert await repo.get(world.b_customer.id) is None


async def test_latest_requirement_set(db: AsyncSession, world: World) -> None:
    bind_tenant(db, world.a.id)
    repo = RequirementSetRepository(db)
    latest = await repo.latest(world.a_customer.id)
    assert latest is not None and latest.version == 2 and latest.require_signature
    assert await repo.latest(world.b_customer.id) is None  # other tenant
