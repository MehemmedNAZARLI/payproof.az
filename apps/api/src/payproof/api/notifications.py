"""The current user's notifications — never anyone else's, even in the same company."""

import datetime as dt
import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Response
from pydantic import BaseModel
from sqlalchemy import func, select

from payproof.api.deps import CurrentMember, Session
from payproof.core.errors import NotFound
from payproof.core.paging import decode_cursor, encode_cursor
from payproof.repositories.models import InvoicePackage, Notification
from payproof.schemas.packages import PackageRef

router = APIRouter(tags=["notifications"])


class NotificationOut(BaseModel):
    id: uuid.UUID
    text: str
    package: PackageRef | None
    created_at: dt.datetime
    read_at: dt.datetime | None


class NotificationPage(BaseModel):
    items: list[NotificationOut]
    next_cursor: str | None
    unread_count: int


@router.get("/notifications")
async def list_notifications(
    session: Session,
    member: CurrentMember,
    unread_only: bool = False,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    cursor: str | None = None,
) -> NotificationPage:
    mine = Notification.user_id == member.user_id
    unread = await session.scalar(
        select(func.count()).select_from(Notification).where(mine, Notification.read_at.is_(None))
    )
    q = (
        select(Notification, InvoicePackage.invoice_number)
        .outerjoin(InvoicePackage, InvoicePackage.id == Notification.package_id)
        .where(mine)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
    )
    if unread_only:
        q = q.where(Notification.read_at.is_(None))
    start = decode_cursor(cursor)
    rows = (await session.execute(q.offset(start).limit(limit + 1))).all()
    return NotificationPage(
        items=[
            NotificationOut(
                id=n.id,
                text=n.text,
                package=PackageRef(id=n.package_id, invoice_number=number or "")
                if n.package_id
                else None,
                created_at=n.created_at,
                read_at=n.read_at,
            )
            for n, number in rows[:limit]
        ],
        next_cursor=encode_cursor(start + limit) if len(rows) > limit else None,
        unread_count=unread or 0,
    )


@router.post("/notifications/{notification_id}/read", status_code=204)
async def mark_read(
    notification_id: uuid.UUID, session: Session, member: CurrentMember
) -> Response:
    n = await session.scalar(
        select(Notification).where(
            Notification.id == notification_id, Notification.user_id == member.user_id
        )
    )
    if n is None:
        raise NotFound  # also someone else's
    n.read_at = n.read_at or dt.datetime.now(dt.UTC)  # idempotent
    await session.commit()
    return Response(status_code=204)


@router.post("/notifications/read-all", status_code=204)
async def mark_all_read(session: Session, member: CurrentMember) -> Response:
    now = dt.datetime.now(dt.UTC)
    for n in await session.scalars(
        select(Notification).where(
            Notification.user_id == member.user_id, Notification.read_at.is_(None)
        )
    ):
        n.read_at = now
    await session.commit()
    return Response(status_code=204)
