"""`POST /v1/packages/{id}/approve` — approver only; idempotent per version and per key."""

import hashlib
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from payproof.api.deps import Member, Session, require
from payproof.domain.permissions import Permission
from payproof.repositories import package_reads as reads
from payproof.schemas.auth import UserRef
from payproof.services import detail_parts as parts
from payproof.services import idempotency
from payproof.services.approval import approve

router = APIRouter(tags=["approval"])
Approver = Annotated[Member, Depends(require(Permission.APPROVE_PACKAGE))]
ENDPOINT = "approvePackage"


class Approve(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_version: int = Field(ge=1)
    expected_requirement_set_version: int = Field(ge=1)
    documents_reviewed: Literal[True]  # the approver confirms every document was opened


@router.post("/packages/{package_id}/approve")
async def approve_package(
    package_id: uuid.UUID,
    body: Approve,
    session: Session,
    member: Approver,
    key: Annotated[uuid.UUID, Header(alias="Idempotency-Key")],
) -> JSONResponse:
    digest = hashlib.sha256(f"{package_id}|{body.model_dump_json()}".encode()).hexdigest()
    replay = await idempotency.claim(session, endpoint=ENDPOINT, key=key, request_hash=digest)
    if replay:
        return JSONResponse(replay.body, status_code=replay.status_code)
    done = await approve(
        session,
        actor_id=member.user_id,
        package_id=package_id,
        expected_version=body.expected_version,
        expected_rule_set_version=body.expected_requirement_set_version,
    )
    users = await reads.owners(session, {done.approval.approver_id})

    def ref(user_id: uuid.UUID) -> UserRef:
        user, role = users[user_id]
        return UserRef(id=user.id, full_name=user.full_name, title=user.title, role=role)

    out = parts.approval(
        done.approval, {done.approval.requirement_set_id: done.rule_set_version}, ref
    ).model_dump(mode="json")
    await idempotency.complete(session, endpoint=ENDPOINT, key=key, status_code=200, body=out)
    await session.commit()
    return JSONResponse(out)
