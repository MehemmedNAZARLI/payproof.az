import pytest
from sqlalchemy import delete, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.base import bind_tenant
from payproof.repositories.models import AuditEvent
from tests.integration.factories import Tenant, add, add_fails, package


def _event(t: Tenant, **over: object) -> AuditEvent:
    fields: dict[str, object] = {
        "action": "package.approved",
        "object_type": "approval",
        "message": "v1 · qayda dəsti v2",
    }
    fields.update(over)
    return AuditEvent(company_id=t.company.id, **fields)


async def test_system_and_user_events(db: AsyncSession, a: Tenant) -> None:
    pkg = package(a)
    await add(db, pkg)
    system = _event(a, action="task.resolved", correlation_id="cid-1")  # actor NULL = system
    user = _event(a, actor_id=a.user.id, package_id=pkg.id, package_version=1, detail={"v": 1})
    await add(db, system, user)
    await db.refresh(system)
    assert (system.actor_id, system.detail) == (None, {})


async def test_audit_rows_cannot_be_updated(db: AsyncSession, a: Tenant) -> None:
    event = _event(a)
    await add(db, event)
    event.action = "package.deleted"
    with pytest.raises(IntegrityError):
        async with db.begin_nested():
            await db.flush()


@pytest.mark.parametrize("bulk", ["update", "delete"])
async def test_bulk_change_is_rejected(db: AsyncSession, a: Tenant, bulk: str) -> None:
    await add(db, _event(a))
    bind_tenant(db, a.company.id)
    stmt = update(AuditEvent).values(action="x.y") if bulk == "update" else delete(AuditEvent)
    with pytest.raises(IntegrityError):
        await db.execute(stmt)


async def test_message_is_required(db: AsyncSession, a: Tenant) -> None:
    await add_fails(db, _event(a, message=""))


@pytest.mark.parametrize("action", ["approved", "Package.Approved", "package.approved!"])
async def test_action_format(db: AsyncSession, a: Tenant, action: str) -> None:
    await add_fails(db, _event(a, action=action))


async def test_actor_must_be_member(db: AsyncSession, a: Tenant, b: Tenant) -> None:
    await add_fails(db, _event(a, actor_id=b.user.id))
