"""What a new run changes around the package (rules-engine.md): tasks — the only place one
becomes RESOLVED — the problem clock, and a notice to approvers when it becomes ready."""

import datetime as dt
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.domain.enums import CheckOutcome, PackageStatus, Role, TaskStatus
from payproof.domain.format import format_money
from payproof.domain.money import Money
from payproof.domain.rules.result import CheckResult
from payproof.repositories.models import InvoicePackage, Membership, ResolutionTask
from payproof.services.audit import record
from payproof.services.notifications import notify

_SETTLED = {CheckOutcome.PASS, CheckOutcome.NOT_APPLICABLE}
_PROBLEM = {PackageStatus.NEEDS_REVIEW, PackageStatus.NEEDS_FIX}


async def settle_tasks(
    session: AsyncSession, pkg: InvoicePackage, checks: Sequence[CheckResult]
) -> None:
    outcome = {c.rule_id: c.outcome for c in checks}
    tasks = await session.scalars(
        select(ResolutionTask).where(
            ResolutionTask.package_id == pkg.id,
            ResolutionTask.status != TaskStatus.RESOLVED,
            ResolutionTask.deleted_at.is_(None),
        )
    )
    for t in tasks:
        if outcome.get(t.rule_id) in _SETTLED:
            t.status, t.resolved_at = TaskStatus.RESOLVED, dt.datetime.now(dt.UTC)
            action, message = "task.resolved", f"{t.number}: {t.rule_id} yoxlaması keçdi"
        elif t.status == TaskStatus.SUBMITTED_FOR_RECHECK:
            t.status = TaskStatus.IN_PROGRESS  # back to the assignee: the rule still fails
            action, message = "task.reopened", f"{t.number}: {t.rule_id} hələ keçmir"
        else:
            continue
        await record(
            session,
            actor_id=None,
            action=action,
            message=message,
            object_type="task",
            object_id=t.id,
            package=pkg,
        )


async def status_changed(
    session: AsyncSession,
    pkg: InvoicePackage,
    before: PackageStatus,
    after: PackageStatus,
    total: Money | None,
) -> None:
    if after in _PROBLEM:
        pkg.problem_since = pkg.problem_since or dt.datetime.now(dt.UTC)
    else:
        pkg.problem_since = None
    if after is not PackageStatus.READY_FOR_APPROVAL or before is after:
        return
    approvers = await session.scalars(
        select(Membership.user_id).where(
            Membership.role == Role.APPROVER, Membership.active.is_(True)
        )
    )
    amount = f" · {format_money(total)}" if total else ""
    await notify(session, pkg, approvers, f"{pkg.invoice_number} təsdiqinizi gözləyir{amount}")
