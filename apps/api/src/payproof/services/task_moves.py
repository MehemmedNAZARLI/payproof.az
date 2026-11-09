"""Moving a task forward, editing it, cancelling it. Submitting asks for an immediate
re-validation — the only way a task becomes RESOLVED."""

import datetime as dt
import uuid
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.errors import NotFound
from payproof.domain.enums import TaskStatus
from payproof.repositories.models import InvoicePackage, ResolutionTask
from payproof.services.audit import record
from payproof.services.linking import locked_package
from payproof.services.tasks import TaskStatusNotAllowed, assignee_role, check_due, notify
from payproof.services.validation import revalidate

NEXT = {
    TaskStatus.OPEN: TaskStatus.IN_PROGRESS,
    TaskStatus.IN_PROGRESS: TaskStatus.SUBMITTED_FOR_RECHECK,
}


@dataclass(frozen=True)
class TaskPatch:
    status: TaskStatus | None = None
    assignee_id: uuid.UUID | None = None
    step: str | None = None
    due_date: dt.date | None = None
    comment: str | None = None
    sent: frozenset[str] = field(default=frozenset())  # fields present in the request


async def _open(session: AsyncSession, task_id: uuid.UUID) -> tuple[ResolutionTask, InvoicePackage]:
    task = await session.scalar(
        select(ResolutionTask).where(
            ResolutionTask.id == task_id, ResolutionTask.deleted_at.is_(None)
        )
    )
    if task is None:
        raise NotFound  # also cancelled, or another company's
    pkg = await locked_package(session, task.package_id)
    if task.status == TaskStatus.RESOLVED:
        raise TaskStatusNotAllowed("Həll edilmiş tapşırıq dəyişdirilə bilməz.")
    return task, pkg


async def _audit(
    session: AsyncSession, actor_id: uuid.UUID, task: ResolutionTask, pkg: InvoicePackage,
    action: str, message: str,
) -> None:  # fmt: skip
    await record(
        session, actor_id=actor_id, action=action, message=message,
        object_type="task", object_id=task.id, package=pkg,
    )  # fmt: skip


async def update_task(
    session: AsyncSession, *, actor_id: uuid.UUID, task_id: uuid.UUID, patch: TaskPatch
) -> ResolutionTask:
    task, pkg = await _open(session, task_id)
    if patch.status == TaskStatus.RESOLVED:
        raise TaskStatusNotAllowed(details={"requested": TaskStatus.RESOLVED.value})
    moves = patch.status is not None and patch.status != task.status
    if moves and NEXT.get(TaskStatus(task.status)) != patch.status:
        raise TaskStatusNotAllowed(
            f"{task.status} → {patch.status} keçidi mümkün deyil.",
            {"from": task.status, "to": patch.status},
        )
    if patch.due_date is not None:
        check_due(patch.due_date)
    role = (
        await assignee_role(session, pkg.company_id, patch.assignee_id)
        if patch.assignee_id
        else None
    )
    changed = [
        name for name in ("assignee_id", "step", "due_date", "comment")
        if name in patch.sent and getattr(patch, name) != getattr(task, name)
    ]  # fmt: skip
    for name in changed:
        setattr(task, name, getattr(patch, name))
    if changed:
        await _audit(session, actor_id, task, pkg, "task.updated",
                     f"{task.number}: {', '.join(changed)} dəyişdi")  # fmt: skip
    if role and patch.assignee_id and "assignee_id" in changed and patch.assignee_id != actor_id:
        await notify(session, pkg, patch.assignee_id, role, f"Tapşırıq {task.number} sizə verildi")
    if moves and patch.status == TaskStatus.IN_PROGRESS:
        task.status = TaskStatus.IN_PROGRESS
        await _audit(session, actor_id, task, pkg, "task.started", task.number)
    elif moves:
        task.status = TaskStatus.SUBMITTED_FOR_RECHECK
        await _audit(session, actor_id, task, pkg, "task.submitted", task.number)
        if pkg.owner_id != actor_id:
            owner_role = await assignee_role(session, pkg.company_id, pkg.owner_id)
            text = f"{task.number} yenidən yoxlamaya göndərildi ({pkg.invoice_number})."
            await notify(session, pkg, pkg.owner_id, owner_role, text)
        await revalidate(session, pkg)  # may resolve it right away
    await session.commit()
    return task


async def cancel_task(session: AsyncSession, *, actor_id: uuid.UUID, task_id: uuid.UUID) -> None:
    """Soft delete; the check result does not change."""
    task, pkg = await _open(session, task_id)
    task.deleted_at = dt.datetime.now(dt.UTC)
    await _audit(session, actor_id, task, pkg, "task.cancelled", f"{task.number} · {task.rule_id}")
    await session.commit()
