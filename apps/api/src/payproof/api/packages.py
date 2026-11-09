"""Package list and dashboard (read-only)."""

import datetime as dt
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from payproof.api.deps import Member, Session, require
from payproof.core.errors import DomainError
from payproof.domain.enums import PackageStatus
from payproof.domain.permissions import Permission
from payproof.schemas import packages as s
from payproof.schemas.detail import PackageDetail
from payproof.services import package_list
from payproof.services.dashboard import build_dashboard
from payproof.services.package_detail import package_detail
from payproof.services.package_query import load_states

router = APIRouter(tags=["packages"])
Viewer = Annotated[Member, Depends(require(Permission.VIEW))]
SORT_PATTERN = f"^-?({'|'.join(package_list.SORT_KEYS)})$"


def _statuses(raw: str | None) -> frozenset[PackageStatus]:
    """`status=NEEDS_FIX,NEEDS_REVIEW` (openapi: form, explode=false)."""
    try:
        return frozenset(PackageStatus(v) for v in (raw or "").split(",") if v)
    except ValueError:
        raise DomainError(
            "Sorğu yanlışdır.", details={"fields": [{"loc": ["query", "status"]}]}
        ) from None


@router.get("/dashboard", response_model=s.Dashboard, tags=["dashboard"])
async def get_dashboard(session: Session, _: Viewer) -> s.Dashboard:
    return await build_dashboard(session, now=dt.datetime.now(dt.UTC))


@router.get("/packages/{package_id}", response_model=PackageDetail)
async def get_package(package_id: uuid.UUID, session: Session, member: Viewer) -> PackageDetail:
    return await package_detail(session, package_id, viewer_role=member.role)


@router.get("/packages", response_model=s.PackagePage)
async def list_packages(
    session: Session,
    _: Viewer,
    status: str | None = None,
    customer_id: uuid.UUID | None = None,
    owner_id: uuid.UUID | None = None,
    issue: Annotated[str | None, Query(pattern=r"^R-0(0[1-9]|10)$")] = None,
    date_from: Annotated[dt.date | None, Query(alias="from")] = None,
    date_to: Annotated[dt.date | None, Query(alias="to")] = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    sort: Annotated[str, Query(pattern=SORT_PATTERN)] = "-updated_at",
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    cursor: str | None = None,
) -> s.PackagePage:
    query = package_list.ListQuery(
        statuses=_statuses(status),
        customer_id=customer_id,
        owner_id=owner_id,
        issue=issue,
        date_from=date_from,
        date_to=date_to,
        q=q,
        sort=sort,
        limit=limit,
        cursor=cursor,
    )
    return package_list.page(await load_states(session), query)
