import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from tests.integration.factories import Tenant, make_tenant


@pytest.fixture
async def a(db: AsyncSession) -> Tenant:
    return await make_tenant(db)


@pytest.fixture
async def b(db: AsyncSession) -> Tenant:
    return await make_tenant(db)
