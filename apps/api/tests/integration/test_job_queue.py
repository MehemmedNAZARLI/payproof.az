import asyncio
import datetime as dt
from collections.abc import AsyncIterator

import pytest
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from payproof.core.errors import ErrorCode
from payproof.repositories.models import Company, Job
from payproof.worker.queue import BACKOFF, PostgresQueue
from tests.integration.factories import Tenant

queue = PostgresQueue()


async def test_claim_order_and_retry_with_backoff(db: AsyncSession, a: Tenant) -> None:
    first = await queue.enqueue(db, company_id=a.company.id, kind="extract_document", payload={})
    later = await queue.enqueue(db, company_id=a.company.id, kind="extract_document", payload={})
    later.run_after = dt.datetime.now(dt.UTC) + dt.timedelta(hours=1)  # not due yet
    job = await queue.claim(db)
    assert job is first and (job.status, job.attempts) == ("RUNNING", 1)
    assert await queue.claim(db) is None  # RUNNING and not-yet-due jobs are not handed out

    before = dt.datetime.now(dt.UTC)
    assert await queue.fail(db, job, ErrorCode.INTERNAL_ERROR) is False
    assert job.status == "QUEUED" and job.run_after >= before + BACKOFF
    for attempt in (2, 3):
        job.run_after = before  # due now
        assert await queue.claim(db) is job and job.attempts == attempt
        final = await queue.fail(db, job, ErrorCode.INTERNAL_ERROR)
    assert final and (job.status, job.error_code) == ("FAILED", "INTERNAL_ERROR")
    assert job.result is None  # a failed job never carries a business result


async def test_job_of_a_dead_worker_is_claimed_again(db: AsyncSession, a: Tenant) -> None:
    job = await queue.enqueue(db, company_id=a.company.id, kind="extract_document", payload={})
    assert await queue.claim(db) is job
    job.locked_at = dt.datetime.now(dt.UTC) - dt.timedelta(hours=1)
    assert await queue.claim(db) is job and job.attempts == 2


@pytest.fixture
async def committed_jobs(db_engine: AsyncEngine) -> AsyncIterator[list[Job]]:
    """Real commits: SKIP LOCKED only matters between two transactions."""
    async with AsyncSession(db_engine, expire_on_commit=False) as s:
        company = Company(name="Queue Test MMC", voen="9900000001")
        s.add(company)
        await s.flush()
        jobs = [Job(company_id=company.id, kind="extract_document", payload={}) for _ in range(2)]
        s.add_all(jobs)
        await s.commit()
    yield jobs
    async with AsyncSession(db_engine) as s:
        await s.execute(delete(Job).where(Job.company_id == company.id))
        await s.execute(delete(Company).where(Company.id == company.id))
        await s.commit()


async def test_two_workers_never_take_the_same_job(
    db_engine: AsyncEngine, committed_jobs: list[Job]
) -> None:
    async with AsyncSession(db_engine) as w1, AsyncSession(db_engine) as w2:
        j1, j2 = await asyncio.gather(queue.claim(w1), queue.claim(w2))
        third = await queue.claim(w1)  # both rows are taken
        assert j1 is not None and j2 is not None and j1.id != j2.id
        assert {j1.id, j2.id} == {j.id for j in committed_jobs} and third is None
        await w1.rollback()
        await w2.rollback()
