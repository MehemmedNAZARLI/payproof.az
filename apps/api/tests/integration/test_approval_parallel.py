import asyncio
from collections.abc import AsyncIterator

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from payproof.repositories.base import bind_tenant
from payproof.repositories.models import ApprovalRecord
from payproof.seed.cli import reset, seed
from payproof.seed.fixtures import uid
from payproof.seed.identity import COMPANY_ID
from payproof.services.approval import Approved, approve


@pytest.fixture
async def committed(db_engine: AsyncEngine) -> AsyncIterator[AsyncEngine]:
    """Row locks only matter between real transactions: seed for real, wipe afterwards so
    the rolled-back tests that follow still start from an empty database."""
    async with AsyncSession(db_engine) as s:
        await seed(s)
        await s.commit()
    try:
        yield db_engine
    finally:
        async with AsyncSession(db_engine) as s:
            await reset(s)
            await s.commit()


async def _approve(engine: AsyncEngine) -> Approved:
    async with AsyncSession(engine, expire_on_commit=False) as s:
        bind_tenant(s, COMPANY_ID)
        done = await approve(
            s, actor_id=uid("u2"), package_id=uid("pkg_1038"), expected_version=1,
            expected_rule_set_version=2,
        )  # fmt: skip
        await s.commit()
        return done


async def test_two_parallel_requests_make_one_approval(committed: AsyncEngine) -> None:
    a, b = await asyncio.gather(_approve(committed), _approve(committed))
    assert a.approval.id == b.approval.id
    assert sorted([a.created, b.created]) == [False, True]  # the second waited, then found it
    async with AsyncSession(committed) as s:
        bind_tenant(s, COMPANY_ID)
        n = await s.scalar(
            select(func.count())
            .select_from(ApprovalRecord)
            .where(ApprovalRecord.package_id == uid("pkg_1038"))
        )
    assert n == 1
