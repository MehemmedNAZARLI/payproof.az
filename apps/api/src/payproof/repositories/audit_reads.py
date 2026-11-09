"""Audit log search, newest first, filtered and paged in SQL (the session is tenant-bound)."""

import datetime as dt
import uuid
from dataclasses import dataclass
from typing import Literal

from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.domain.enums import Role
from payproof.repositories.models import AuditEvent, InvoicePackage, Membership, User

SYSTEM_NAME = "Sistem"


@dataclass(frozen=True)
class AuditFilter:
    package_id: uuid.UUID | None = None
    q: str | None = None
    actor: uuid.UUID | Literal["system"] | None = None
    date_from: dt.datetime | None = None
    date_to: dt.datetime | None = None


@dataclass(frozen=True)
class AuditRow:
    event: AuditEvent
    invoice_number: str | None
    actor: User | None
    actor_role: Role | None


def _query(f: AuditFilter) -> Select[AuditEvent, str | None, User, str]:  # outer joins: may be NULL
    q = (
        select(AuditEvent, InvoicePackage.invoice_number, User, Membership.role)
        .outerjoin(InvoicePackage, InvoicePackage.id == AuditEvent.package_id)
        .outerjoin(User, User.id == AuditEvent.actor_id)
        .outerjoin(
            Membership,
            and_(
                Membership.user_id == AuditEvent.actor_id,
                Membership.company_id == AuditEvent.company_id,
            ),
        )
    )
    if f.package_id:
        q = q.where(AuditEvent.package_id == f.package_id)
    if f.actor == "system":
        q = q.where(AuditEvent.actor_id.is_(None))
    elif f.actor:
        q = q.where(AuditEvent.actor_id == f.actor)
    if f.date_from:
        q = q.where(AuditEvent.created_at >= f.date_from)
    if f.date_to:
        q = q.where(AuditEvent.created_at <= f.date_to)
    if f.q and (text := f.q.strip()):
        like = f"%{text.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')}%"
        q = q.where(
            or_(
                AuditEvent.message.ilike(like, escape="\\"),
                AuditEvent.action.ilike(like, escape="\\"),
                InvoicePackage.invoice_number.ilike(like, escape="\\"),
                func.coalesce(User.full_name, SYSTEM_NAME).ilike(like, escape="\\"),
            )
        )
    return q.order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc())


async def search(
    session: AsyncSession, f: AuditFilter, *, offset: int = 0, limit: int | None = None
) -> list[AuditRow]:
    q = _query(f).offset(offset)
    if limit is not None:
        q = q.limit(limit)
    return [
        AuditRow(event, number, user, Role(role) if role else None)
        for event, number, user, role in (await session.execute(q)).all()
    ]
