"""Job queue (ADR-0005): Postgres rows, claimed with FOR UPDATE SKIP LOCKED. `jobs` is outside
the tenant guard — the worker serves every company; tenant reads filter `company_id` themselves."""

import datetime as dt
import uuid
from typing import Any, Protocol

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.errors import ErrorCode
from payproof.repositories.models import Job

BACKOFF = dt.timedelta(seconds=5)  # retry n waits BACKOFF * 2**(n-1)
STALE = dt.timedelta(minutes=10)  # a RUNNING job this old lost its worker


class JobQueue(Protocol):
    async def enqueue(
        self, session: AsyncSession, *, company_id: uuid.UUID, kind: str, payload: dict[str, Any]
    ) -> Job: ...

    async def claim(self, session: AsyncSession) -> Job | None: ...

    async def succeed(self, session: AsyncSession, job: Job, result: dict[str, Any]) -> None: ...

    async def fail(self, session: AsyncSession, job: Job, code: ErrorCode) -> bool: ...


class PostgresQueue:
    async def enqueue(
        self, session: AsyncSession, *, company_id: uuid.UUID, kind: str, payload: dict[str, Any]
    ) -> Job:
        job = Job(company_id=company_id, kind=kind, payload=payload)
        session.add(job)
        await session.flush()
        return job

    async def claim(self, session: AsyncSession) -> Job | None:
        """Oldest due job, or None. Another worker's locked row is skipped, never waited on;
        the caller commits right away so the claim is visible."""
        now = dt.datetime.now(dt.UTC)
        job = await session.scalar(
            select(Job)
            .where(
                or_(
                    (Job.status == "QUEUED") & (Job.run_after <= now),
                    (Job.status == "RUNNING") & (Job.locked_at < now - STALE),
                )
            )
            .order_by(Job.run_after, Job.id)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        if job is None:
            return None
        job.status, job.locked_at, job.attempts = "RUNNING", now, job.attempts + 1
        await session.flush()
        return job

    async def succeed(self, session: AsyncSession, job: Job, result: dict[str, Any]) -> None:
        job.status, job.result, job.locked_at = "SUCCEEDED", result, None
        await session.flush()

    async def fail(self, session: AsyncSession, job: Job, code: ErrorCode) -> bool:
        """True = final (FAILED); False = queued again with exponential backoff."""
        job.locked_at = None
        if job.attempts >= job.max_attempts:
            job.status, job.error_code = "FAILED", code.value
            await session.flush()
            return True
        job.status = "QUEUED"
        job.run_after = dt.datetime.now(dt.UTC) + BACKOFF * 2 ** (job.attempts - 1)
        await session.flush()
        return False
