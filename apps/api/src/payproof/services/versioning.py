"""Package version bump: any material change (document, critical field, order link, rules)
makes the current approval invalid — kept in the audit, the approver is told (CLAUDE.md)."""

import datetime as dt

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.models import ApprovalRecord, InvoicePackage
from payproof.services.audit import record
from payproof.services.notifications import notify


async def bump(session: AsyncSession, pkg: InvoicePackage, reason: str) -> None:
    """`reason` is Azerbaijani, lower case: "təhvil sənədinin yeni versiyası yükləndi"."""
    pkg.version += 1
    now = dt.datetime.now(dt.UTC)
    approvals = await session.scalars(
        select(ApprovalRecord).where(
            ApprovalRecord.package_id == pkg.id,
            ApprovalRecord.valid.is_(True),
            ApprovalRecord.package_version < pkg.version,
        )
    )
    for a in approvals:
        a.valid, a.invalidated_reason, a.invalidated_at = False, reason, now
        await record(
            session,
            actor_id=None,
            action="approval.invalidated",
            message=f"v{a.package_version} təsdiqi qüvvədən düşdü: {reason}. "
            "Əvvəlki təsdiq auditdə saxlanılır.",
            object_type="approval",
            object_id=a.id,
            package=pkg,
            detail={"approval_version": a.package_version},
        )
        await notify(
            session,
            pkg,
            [a.approver_id],
            f"{pkg.invoice_number or 'Paket'}: {reason}. v{a.package_version} təsdiqi "
            f"etibarsızlaşdı — v{pkg.version} yenidən təsdiq tələb edir.",
        )
    await session.flush()
