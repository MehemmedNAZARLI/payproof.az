"""Review actions on a package: order link suggestions and confirmation."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select

from payproof.api.deps import Member, Session, require
from payproof.core.errors import NotFound
from payproof.domain.permissions import Permission
from payproof.repositories.models import InvoicePackage
from payproof.schemas.detail import MatchCandidate, PackageDetail
from payproof.services import corrections, review
from payproof.services.linking import confirm_link
from payproof.services.package_detail import match_candidates, package_detail

router = APIRouter(tags=["review"])
Viewer = Annotated[Member, Depends(require(Permission.VIEW))]
Editor = Annotated[Member, Depends(require(Permission.EDIT_PACKAGE))]


class CandidateList(BaseModel):
    items: list[MatchCandidate]


async def visible_package(session: Session, package_id: uuid.UUID) -> InvoicePackage:
    pkg = await session.scalar(
        select(InvoicePackage).where(
            InvoicePackage.id == package_id, InvoicePackage.deleted_at.is_(None)
        )
    )
    if pkg is None:
        raise NotFound  # also another company's package
    return pkg


class ConfirmMatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    order_id: uuid.UUID
    expected_version: int = Field(ge=1)


@router.post("/packages/{package_id}/matches")
async def confirm_match(
    package_id: uuid.UUID, body: ConfirmMatch, session: Session, member: Editor
) -> PackageDetail:
    await confirm_link(
        session,
        actor_id=member.user_id,
        package_id=package_id,
        order_id=body.order_id,
        expected_version=body.expected_version,
    )
    return await package_detail(session, package_id, viewer_role=member.role)


class Versioned(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_version: int = Field(ge=1)


@router.post("/packages/{package_id}/validate")
async def validate_package(
    package_id: uuid.UUID, body: Versioned, session: Session, member: Editor
) -> PackageDetail:
    await review.validate_now(
        session,
        actor_id=member.user_id,
        package_id=package_id,
        expected_version=body.expected_version,
    )
    return await package_detail(session, package_id, viewer_role=member.role)


@router.post("/packages/{package_id}/signature-review")
async def review_signature(
    package_id: uuid.UUID, body: Versioned, session: Session, member: Editor
) -> PackageDetail:
    await review.review_signature(
        session,
        actor_id=member.user_id,
        package_id=package_id,
        expected_version=body.expected_version,
    )
    return await package_detail(session, package_id, viewer_role=member.role)


class CorrectField(BaseModel):
    model_config = ConfigDict(extra="forbid")

    value: str
    # missing or short → 422 from the service (B-18: a reason of ≥ 5 characters is required)
    reason: str = Field(default="", max_length=500)
    expected_version: int = Field(ge=1)


@router.patch("/fields/{field_id}")
async def correct_field(
    field_id: uuid.UUID, body: CorrectField, session: Session, member: Editor
) -> PackageDetail:
    package_id = await corrections.correct_field(
        session,
        actor_id=member.user_id,
        field_id=field_id,
        value=body.value,
        reason=body.reason,
        expected_version=body.expected_version,
    )
    return await package_detail(session, package_id, viewer_role=member.role)


@router.get("/packages/{package_id}/match-candidates")
async def list_match_candidates(
    package_id: uuid.UUID, session: Session, _: Viewer
) -> CandidateList:
    pkg = await visible_package(session, package_id)
    return CandidateList(items=await match_candidates(session, pkg))
