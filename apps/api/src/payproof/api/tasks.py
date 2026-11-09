"""Resolution tasks: create for a failing/unknown check, move forward, cancel, list."""

import datetime as dt
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.api.deps import Member, Session, require
from payproof.core.errors import InvalidInput
from payproof.core.paging import decode_cursor, encode_cursor
from payproof.domain.enums import TaskStatus
from payproof.domain.permissions import Permission
from payproof.repositories import package_reads as reads
from payproof.repositories.models import InvoicePackage, ResolutionTask
from payproof.schemas.auth import UserRef
from payproof.schemas.detail import Task
from payproof.services import detail_parts as parts
from payproof.services import task_moves, tasks

router = APIRouter(tags=["tasks"])
Manager = Annotated[Member, Depends(require(Permission.MANAGE_TASKS))]
Viewer = Annotated[Member, Depends(require(Permission.VIEW))]


class CreateTask(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rule_id: str = Field(pattern=r"^R-\d{3}$")
    assignee_id: uuid.UUID
    step: str = Field(min_length=3, max_length=1000)
    due_date: dt.date
    comment: str | None = Field(default=None, max_length=1000)


async def task_out(session: AsyncSession, t: ResolutionTask) -> Task:
    users = await reads.owners(session, {t.assignee_id, t.created_by})
    pkg = await session.get_one(InvoicePackage, t.package_id)

    def ref(user_id: uuid.UUID) -> UserRef:
        user, role = users[user_id]
        return UserRef(id=user.id, full_name=user.full_name, title=user.title, role=role)

    return parts.task(t, pkg.invoice_number or "", ref)


class UpdateTask(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # RESOLVED is accepted here so the service can answer 422 TASK_STATUS_NOT_ALLOWED
    status: Literal["OPEN", "IN_PROGRESS", "SUBMITTED_FOR_RECHECK", "RESOLVED"] | None = None
    assignee_id: uuid.UUID | None = None
    step: str | None = Field(default=None, min_length=3, max_length=1000)
    due_date: dt.date | None = None
    comment: str | None = Field(default=None, max_length=1000)


@router.patch("/tasks/{task_id}")
async def update_task(
    task_id: uuid.UUID, body: UpdateTask, session: Session, member: Manager
) -> Task:
    if not body.model_fields_set:
        raise InvalidInput("Dəyişiklik göndərilməyib.")
    data = body.model_dump(exclude={"status"})
    patch = task_moves.TaskPatch(
        status=TaskStatus(body.status) if body.status else None,
        sent=frozenset(body.model_fields_set),
        **data,
    )
    task = await task_moves.update_task(
        session, actor_id=member.user_id, task_id=task_id, patch=patch
    )
    return await task_out(session, task)


class TaskPage(BaseModel):
    items: list[Task]
    next_cursor: str | None
    status_counts: dict[TaskStatus, int]


@router.get("/tasks")
async def list_tasks(
    session: Session,
    _: Viewer,
    status: Literal["active", "OPEN", "IN_PROGRESS", "SUBMITTED_FOR_RECHECK", "RESOLVED"] = (
        "active"
    ),
    assignee_id: uuid.UUID | None = None,
    package_id: uuid.UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    cursor: str | None = None,
) -> TaskPage:
    base = (
        select(ResolutionTask, InvoicePackage.invoice_number)
        .join(InvoicePackage, InvoicePackage.id == ResolutionTask.package_id)
        .where(ResolutionTask.deleted_at.is_(None), InvoicePackage.deleted_at.is_(None))
    )
    if assignee_id:
        base = base.where(ResolutionTask.assignee_id == assignee_id)
    if package_id:
        base = base.where(ResolutionTask.package_id == package_id)
    counts = dict.fromkeys(TaskStatus, 0)
    for t, _number in (await session.execute(base)).all():
        counts[TaskStatus(t.status)] += 1  # same filters, every status
    if status == "active":
        base = base.where(ResolutionTask.status != TaskStatus.RESOLVED)
    else:
        base = base.where(ResolutionTask.status == status)
    start = decode_cursor(cursor)
    rows = (
        await session.execute(
            base.order_by(ResolutionTask.due_date, ResolutionTask.number)
            .offset(start)
            .limit(limit + 1)
        )
    ).all()
    page = rows[:limit]
    users = await reads.owners(session, {u for t, _ in page for u in (t.assignee_id, t.created_by)})

    def ref(user_id: uuid.UUID) -> UserRef:
        user, role = users[user_id]
        return UserRef(id=user.id, full_name=user.full_name, title=user.title, role=role)

    return TaskPage(
        items=[parts.task(t, number or "", ref) for t, number in page],
        next_cursor=encode_cursor(start + limit) if len(rows) > limit else None,
        status_counts=counts,
    )


@router.delete("/tasks/{task_id}", status_code=204)
async def cancel_task(task_id: uuid.UUID, session: Session, member: Manager) -> Response:
    await task_moves.cancel_task(session, actor_id=member.user_id, task_id=task_id)
    return Response(status_code=204)


@router.post("/packages/{package_id}/tasks", status_code=201)
async def create_task(
    package_id: uuid.UUID, body: CreateTask, session: Session, member: Manager
) -> Task:
    new = tasks.NewTask(**body.model_dump())
    task = await tasks.create_task(session, actor_id=member.user_id, package_id=package_id, new=new)
    return await task_out(session, task)
