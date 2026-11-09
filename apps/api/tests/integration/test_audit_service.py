import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.logging import correlation_id
from payproof.repositories.base import TenantContextMissing, bind_tenant
from payproof.services.audit import record
from tests.integration.factories import Tenant, add, package


async def test_record_takes_tenant_version_and_correlation_id(db: AsyncSession, a: Tenant) -> None:
    pkg = package(a, version=3)
    await add(db, pkg)
    bind_tenant(db, a.company.id)
    token = correlation_id.set("cid-audit")
    try:
        event = await record(
            db,
            actor_id=a.user.id,
            action="package.approved",
            message="v3 · qayda dəsti v2",
            object_type="approval",
            package=pkg,
            detail={"requirement_set_version": 2},
        )
    finally:
        correlation_id.reset(token)
    assert (event.company_id, event.package_id, event.package_version) == (
        a.company.id,
        pkg.id,
        3,
    )
    assert (event.correlation_id, event.detail) == ("cid-audit", {"requirement_set_version": 2})
    assert event.id is not None and event.created_at is not None


async def test_system_event_without_package(db: AsyncSession, a: Tenant) -> None:
    bind_tenant(db, a.company.id)
    event = await record(db, actor_id=None, action="rules.changed", message="Qayda dəsti v3")
    assert (event.actor_id, event.package_id, event.package_version) == (None, None, None)


async def test_needs_a_tenant(db: AsyncSession, a: Tenant) -> None:
    with pytest.raises(TenantContextMissing):
        await record(db, actor_id=None, action="rules.changed", message="x")
    # system jobs (seed, worker) name the company explicitly
    event = await record(
        db, actor_id=None, action="rules.changed", message="x", company_id=a.company.id
    )
    assert event.company_id == a.company.id
