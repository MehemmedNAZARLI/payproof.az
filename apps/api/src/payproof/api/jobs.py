"""`GET /v1/jobs/{id}` — processing state of an upload or package creation."""

import datetime as dt
import uuid
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select

from payproof.api.deps import Member, Session, require
from payproof.core.errors import ErrorCode, NotFound
from payproof.domain.permissions import Permission
from payproof.repositories.models import Job

router = APIRouter(tags=["documents"])
Viewer = Annotated[Member, Depends(require(Permission.VIEW))]
_MESSAGES = {ErrorCode.INTERNAL_ERROR: "Sənəd emal oluna bilmədi — faylı yenidən yükləyin."}


class JobError(BaseModel):
    code: ErrorCode
    message: str


class JobOut(BaseModel):
    id: uuid.UUID
    kind: Literal["extract_document", "create_package"]
    status: Literal["QUEUED", "RUNNING", "SUCCEEDED", "FAILED"]
    created_at: dt.datetime
    updated_at: dt.datetime
    result: dict[str, Any] | None
    error: JobError | None


@router.get("/jobs/{job_id}")
async def get_job(job_id: uuid.UUID, session: Session, member: Viewer) -> JobOut:
    # `jobs` is outside the tenant guard (the worker serves all companies): filter here
    job = await session.scalar(
        select(Job).where(Job.id == job_id, Job.company_id == member.company_id)
    )
    if job is None:
        raise NotFound
    code = ErrorCode(job.error_code) if job.error_code else None
    return JobOut(
        id=job.id,
        kind=job.kind,  # CHECK constraints keep kind and status to the contract's values
        status=job.status,
        created_at=job.created_at,
        updated_at=job.updated_at,
        result=job.result,
        error=JobError(code=code, message=_MESSAGES.get(code, "Emal alınmadı.")) if code else None,
    )
