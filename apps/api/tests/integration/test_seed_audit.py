from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.base import bind_tenant
from payproof.repositories.models import AuditEvent, InvoicePackage
from payproof.seed.audit import audit_rows
from payproof.seed.cli import seed
from payproof.seed.fixtures import PACKAGES, load, uid

ACTIONS = {
    "package.created",
    "document.uploaded",
    "document.extracted",
    "link.exact_match",
    "link.candidates_found",
    "approval.created",
    "approval.invalidated",
    "export.created",
    "task.created",
    "task.resolved",
    "validation.run",
}


async def test_demo_history_is_seeded(db: AsyncSession) -> None:
    await seed(db)
    bind_tenant(db, uid("company_a"))
    events = (await db.scalars(select(AuditEvent).order_by(AuditEvent.created_at))).all()
    assert len(events) == len(audit_rows())
    assert {e.action for e in events} >= ACTIONS
    assert sum(e.action == "package.created" for e in events) == len(PACKAGES)
    resolved = [e for e in events if e.action == "task.resolved"]
    assert len(resolved) == sum(1 for t in load("tasks.json") if t["resolved_at"])
    assert all(e.actor_id is None for e in resolved)  # the system resolves tasks


async def test_inv_1036_invalidated_approval_message(db: AsyncSession) -> None:
    await seed(db)
    bind_tenant(db, uid("company_a"))
    msg = await db.scalar(
        select(AuditEvent.message).where(
            AuditEvent.package_id == uid("pkg_1036"), AuditEvent.action == "approval.invalidated"
        )
    )
    assert msg == (
        "v2 təsdiqi qüvvədən düşdü: təhvil sənədinin yeni versiyası yükləndi. "
        "Əvvəlki təsdiq auditdə saxlanılır."
    )


async def test_package_updated_at_is_its_last_event(db: AsyncSession) -> None:
    await seed(db)
    bind_tenant(db, uid("company_a"))
    q = select(AuditEvent.package_id, func.max(AuditEvent.created_at)).group_by(
        AuditEvent.package_id
    )
    last = {pid: at for pid, at in (await db.execute(q)).all()}
    rows = (await db.execute(select(InvoicePackage.id, InvoicePackage.updated_at))).all()
    assert all(updated == last[pid] for pid, updated in rows)
