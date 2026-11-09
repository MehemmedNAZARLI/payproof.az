"""Audit log: per package and company-wide (search, filters, CSV download)."""

import datetime as dt
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select

from payproof.api.deps import Member, Session, require
from payproof.core.errors import InvalidInput, NotFound
from payproof.domain.permissions import Permission
from payproof.repositories.audit_reads import AuditFilter
from payproof.repositories.models import InvoicePackage
from payproof.schemas.audit import AuditPage
from payproof.services.audit_query import audit_csv, audit_page

router = APIRouter(tags=["audit"])
Viewer = Annotated[Member, Depends(require(Permission.VIEW))]
Limit = Annotated[int, Query(ge=1, le=200)]


def _actor(raw: str | None) -> uuid.UUID | Literal["system"] | None:
    if raw is None:
        return None
    if raw == "system":
        return "system"
    try:
        return uuid.UUID(raw)
    except ValueError:
        raise InvalidInput(
            details={"fields": {"actor_id": "`system` və ya istifadəçi ID"}}
        ) from None


@router.get("/packages/{package_id}/audit", response_model=AuditPage)
async def package_audit(
    package_id: uuid.UUID, session: Session, _: Viewer, limit: Limit = 50, cursor: str | None = None
) -> AuditPage:
    exists = await session.scalar(
        select(InvoicePackage.id).where(
            InvoicePackage.id == package_id, InvoicePackage.deleted_at.is_(None)
        )
    )
    if exists is None:
        raise NotFound  # also another tenant's package
    return await audit_page(session, AuditFilter(package_id=package_id), limit=limit, cursor=cursor)


@router.get("/audit", response_model=AuditPage)
async def company_audit(
    session: Session,
    _: Viewer,
    q: Annotated[str | None, Query(max_length=100)] = None,
    actor_id: str | None = None,
    package_id: uuid.UUID | None = None,
    date_from: Annotated[dt.datetime | None, Query(alias="from")] = None,
    date_to: Annotated[dt.datetime | None, Query(alias="to")] = None,
    format: Literal["json", "csv"] = "json",
    limit: Limit = 50,
    cursor: str | None = None,
) -> AuditPage | Response:
    f = AuditFilter(
        package_id=package_id, q=q, actor=_actor(actor_id), date_from=date_from, date_to=date_to
    )
    if format == "csv":
        return Response(
            await audit_csv(session, f),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="audit.csv"'},
        )
    return await audit_page(session, f, limit=limit, cursor=cursor)
