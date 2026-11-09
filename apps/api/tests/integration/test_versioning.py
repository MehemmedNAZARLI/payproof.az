from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.base import bind_tenant
from payproof.repositories.models import (
    ApprovalRecord,
    AuditEvent,
    InvoicePackage,
    Notification,
)
from payproof.seed.cli import seed
from payproof.seed.fixtures import uid
from payproof.seed.identity import COMPANY_ID
from payproof.services.versioning import bump


async def test_bump_invalidates_the_approval_and_tells_the_approver(db: AsyncSession) -> None:
    await seed(db)
    bind_tenant(db, COMPANY_ID)
    pkg = await db.get_one(InvoicePackage, uid("pkg_1035"))
    [approval] = (
        await db.scalars(select(ApprovalRecord).where(ApprovalRecord.package_id == pkg.id))
    ).all()
    assert approval.valid
    before = pkg.version

    await bump(db, pkg, "faktura yeni versiyası yükləndi")

    assert pkg.version == before + 1
    assert (approval.valid, approval.invalidated_reason) == (
        False,
        "faktura yeni versiyası yükləndi",
    )
    event = (
        await db.scalars(
            select(AuditEvent).where(
                AuditEvent.package_id == pkg.id, AuditEvent.action == "approval.invalidated"
            )
        )
    ).one()
    assert (event.actor_id, event.package_version) == (None, before + 1)
    assert event.message.startswith(f"v{approval.package_version} təsdiqi qüvvədən düşdü")
    note = (await db.scalars(select(Notification).where(Notification.package_id == pkg.id))).all()[
        -1
    ]
    assert note.user_id == approval.approver_id and f"v{before + 1} yenidən" in note.text

    await bump(db, pkg, "yenə")  # nothing valid left: no second invalidation
    assert (
        await db.scalar(
            select(AuditEvent.id).where(
                AuditEvent.package_id == pkg.id,
                AuditEvent.action == "approval.invalidated",
                AuditEvent.package_version == before + 2,
            )
        )
    ) is None
