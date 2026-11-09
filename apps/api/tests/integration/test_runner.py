from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from payproof.worker.queue import PostgresQueue
from payproof.worker.runner import run_once
from tests.integration.factories import Tenant

queue = PostgresQueue()


async def test_job_without_a_handler_ends_failed(db: AsyncSession, a: Tenant) -> None:
    job = await queue.enqueue(db, company_id=a.company.id, kind="create_package", payload={})
    await db.commit()
    sessions = async_sessionmaker(
        bind=await db.connection(), join_transaction_mode="create_savepoint", expire_on_commit=False
    )
    for _ in range(3):
        assert await run_once(sessions, queue, {})
        await db.refresh(job)
        job.run_after = func.now()  # skip the backoff wait
        await db.commit()
    await db.refresh(job)
    assert (job.status, job.attempts, job.error_code) == ("FAILED", 3, "INTERNAL_ERROR")
    assert await run_once(sessions, queue, {}) is False
