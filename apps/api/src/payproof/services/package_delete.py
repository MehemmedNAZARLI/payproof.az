"""Soft delete of a package that was never approved — its audit history stays."""

import datetime as dt
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.errors import Conflict, ErrorCode
from payproof.domain.enums import PackageStatus, TaskStatus
from payproof.repositories.models import ApprovalRecord, Customer, ResolutionTask
from payproof.services.audit import record
from payproof.services.linking import locked_package
from payproof.services.package_query import load_states

_DELETABLE = {PackageStatus.PROCESSING, PackageStatus.NEEDS_REVIEW, PackageStatus.NEEDS_FIX}


class PackageNotDeletable(Conflict):
    code = ErrorCode.PACKAGE_NOT_DELETABLE
    message = "Təsdiqlənmiş və ya təsdiqə hazır paket silinə bilməz."


async def delete_package(
    session: AsyncSession, *, actor_id: uuid.UUID, package_id: uuid.UUID
) -> None:
    pkg = await locked_package(session, package_id)  # a deleted one is already 404
    [state] = await load_states(session, [pkg.id])
    ever_approved = await session.scalar(
        select(ApprovalRecord.id).where(ApprovalRecord.package_id == pkg.id).limit(1)
    )
    if ever_approved or state.status not in _DELETABLE:
        raise PackageNotDeletable(details={"status": state.status.value})
    now = dt.datetime.now(dt.UTC)
    pkg.deleted_at = now
    for t in await session.scalars(
        select(ResolutionTask).where(
            ResolutionTask.package_id == pkg.id,
            ResolutionTask.status != TaskStatus.RESOLVED,
            ResolutionTask.deleted_at.is_(None),
        )
    ):
        t.deleted_at = now  # open tasks of a deleted package are cancelled with it
    customer = await session.get_one(Customer, pkg.customer_id)
    what = f"{pkg.invoice_number or 'Paket'} · {customer.name}"
    await record(
        session,
        actor_id=actor_id,
        action="package.deleted",
        message=f"{what} — heç vaxt təsdiqlənməmiş paket",
        package=pkg,
    )
    await session.commit()
