"""One job at a time: claim (own commit), then run in a session bound to the job's company.
Any error → retry with backoff; after the last attempt the handler's `failed` marks the object."""

import logging
import uuid
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from payproof.core.errors import ErrorCode
from payproof.repositories.base import bind_tenant
from payproof.repositories.models import Job
from payproof.worker.queue import JobQueue

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class Handler:
    run: Callable[[AsyncSession, Job], Awaitable[dict[str, Any]]]  # → Job.result
    failed: Callable[[AsyncSession, Job], Awaitable[None]]  # after the last attempt


async def run_once(
    sessions: async_sessionmaker[AsyncSession], queue: JobQueue, handlers: Mapping[str, Handler]
) -> bool:
    """False when nothing was due."""
    async with sessions() as s:
        job = await queue.claim(s)
        if job is None:
            return False
        job_id, company_id = job.id, job.company_id
        await s.commit()  # the claim is visible to other workers before the work starts
    async with sessions() as s:
        bind_tenant(s, company_id)
        await _run(s, queue, handlers, job_id)
    return True


async def _run(
    s: AsyncSession, queue: JobQueue, handlers: Mapping[str, Handler], job_id: uuid.UUID
) -> None:
    job = await s.get_one(Job, job_id)
    handler = handlers.get(job.kind)
    try:
        if handler is None:
            raise LookupError(job.kind)
        result = await handler.run(s, job)
        await queue.succeed(s, job, result)
        await s.commit()
        return
    except Exception as exc:
        # type only: messages may quote document text (security.md)
        log.warning("job %s (%s) failed: %s", job_id, job.kind, type(exc).__name__)
        await s.rollback()
    job = await s.get_one(Job, job_id)
    if await queue.fail(s, job, ErrorCode.INTERNAL_ERROR) and handler is not None:
        await handler.failed(s, job)
    await s.commit()
