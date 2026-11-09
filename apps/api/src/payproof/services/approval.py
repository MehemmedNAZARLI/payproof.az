"""Approval of the current version (state-machines.md, "Təsdiq qaydaları"). "Ready to send" —
never a payment approval. Order: 403 (route) → 409 VERSION_CONFLICT → 200 existing →
409 PACKAGE_NOT_READY → 200 new. The package row lock makes parallel requests queue up: the
second one finds the first one's approval."""

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.errors import Conflict, PackageNotReady
from payproof.domain.enums import CheckOutcome, PackageStatus
from payproof.repositories.models import ApprovalRecord, RequirementSet, User
from payproof.services.audit import record
from payproof.services.linking import locked_package
from payproof.services.notifications import notify
from payproof.services.package_query import load_states


@dataclass(frozen=True)
class Approved:
    approval: ApprovalRecord
    rule_set_version: int
    created: bool


async def approve(
    session: AsyncSession,
    *,
    actor_id: uuid.UUID,
    package_id: uuid.UUID,
    expected_version: int,
    expected_rule_set_version: int,
) -> Approved:
    pkg = await locked_package(session, package_id)
    [state] = await load_states(session, [pkg.id])
    rs = await session.get(RequirementSet, state.rule_set_id) if state.rule_set_id else None
    current_rs = rs.version if rs else None
    if expected_version != pkg.version or expected_rule_set_version != current_rs:
        raise Conflict(
            f"Paket v{pkg.version}-ə yenilənib; səhifəni yeniləyin.",
            {
                "current_version": pkg.version,
                "expected_version": expected_version,
                "current_requirement_set_version": current_rs,
                "expected_requirement_set_version": expected_rule_set_version,
            },
        )
    assert rs is not None  # noqa: S101 — matched the expected version above
    existing = await session.scalar(
        select(ApprovalRecord).where(
            ApprovalRecord.package_id == pkg.id,
            ApprovalRecord.package_version == pkg.version,
            ApprovalRecord.requirement_set_id == rs.id,
            ApprovalRecord.valid.is_(True),
        )
    )
    if existing:
        return Approved(existing, rs.version, created=False)  # no new audit event
    if state.status is not PackageStatus.READY_FOR_APPROVAL or state.run is None:
        blocking = [{"rule_id": b.rule_id, "outcome": b.outcome.value} for b in state.blockers]
        raise PackageNotReady(
            "Bloklayan və ya naməlum yoxlama var — paket təsdiqlənə bilməz.",
            {"status": state.status.value, "blocking": blocking},
        )
    approval = ApprovalRecord(
        company_id=pkg.company_id,
        validation_run_id=state.run.id,
        package_id=pkg.id,
        package_version=pkg.version,
        requirement_set_id=rs.id,
        approver_id=actor_id,
    )
    session.add(approval)
    await session.flush()
    passed = sum(c.outcome is CheckOutcome.PASS for c in state.checks)
    await record(
        session,
        actor_id=actor_id,
        action="approval.created",
        message=f"v{pkg.version} · qayda dəsti v{rs.version} · {passed} yoxlama keçdi. "
        "Bu, ödəniş təsdiqi deyil.",
        object_type="approval",
        object_id=approval.id,
        package=pkg,
    )
    approver = await session.get_one(User, actor_id)
    if pkg.owner_id != actor_id:
        await notify(
            session,
            pkg,
            [pkg.owner_id],
            f"{pkg.invoice_number} {approver.full_name} tərəfindən təsdiqləndi — "
            "paket göndərilməyə hazırdır.",
        )
    pkg.problem_since = None
    await session.flush()  # the caller commits, with its idempotency record
    return Approved(approval, rs.version, created=True)
