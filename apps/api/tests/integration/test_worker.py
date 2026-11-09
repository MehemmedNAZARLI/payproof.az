from collections.abc import Awaitable, Callable

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from payproof.domain.enums import DocumentStatus
from payproof.repositories.base import bind_tenant
from payproof.repositories.models import AuditEvent, DocumentVersion, Job, ValidationRun
from payproof.seed.cli import seed
from payproof.seed.fixtures import uid
from payproof.seed.identity import COMPANY_ID
from payproof.seed.packages import version_id
from payproof.worker.extract import extract_handler
from payproof.worker.queue import PostgresQueue
from payproof.worker.runner import run_once

queue = PostgresQueue()
VERSION = version_id("pkg_1042", "invoice", 1)


@pytest.fixture
async def sessions(db: AsyncSession) -> async_sessionmaker[AsyncSession]:
    """The worker's own sessions, inside the test transaction (commit = savepoint)."""
    await seed(db)
    bind_tenant(db, COMPANY_ID)
    version = await db.get_one(DocumentVersion, VERSION)
    version.status = DocumentStatus.UPLOADED
    await queue.enqueue(
        db,
        company_id=COMPANY_ID,
        kind="extract_document",
        payload={"document_version_id": str(VERSION), "package_id": str(uid("pkg_1042"))},
    )
    await db.commit()
    return async_sessionmaker(
        bind=await db.connection(), join_transaction_mode="create_savepoint", expire_on_commit=False
    )


async def _status(db: AsyncSession) -> tuple[str, str, str]:
    job = (await db.scalars(select(Job).execution_options(populate_existing=True))).one()
    version = await db.get_one(DocumentVersion, VERSION, populate_existing=True)
    return job.status, version.status, job.error_code or ""


async def test_job_runs_and_reports_its_result(
    db: AsyncSession, sessions: async_sessionmaker[AsyncSession]
) -> None:
    assert await run_once(sessions, queue, {"extract_document": extract_handler()})
    assert await _status(db) == ("SUCCEEDED", "REVIEW_REQUIRED", "")
    job = (await db.scalars(select(Job))).one()
    assert job.result is not None and job.result["document_version_id"] == str(VERSION)
    assert await run_once(sessions, queue, {"extract_document": extract_handler()}) is False


def _broken() -> Callable[..., Awaitable[DocumentStatus]]:
    async def extract(*_: object) -> DocumentStatus:
        raise RuntimeError("PDF parser crashed on INV-1042 text")  # never logged

    return extract


async def test_failing_job_retries_then_fails_without_a_business_result(
    db: AsyncSession, sessions: async_sessionmaker[AsyncSession], caplog: pytest.LogCaptureFixture
) -> None:
    runs = await db.scalar(select(func.count()).select_from(ValidationRun))
    handlers = {"extract_document": extract_handler(_broken())}
    for attempt in range(3):
        if attempt:  # skip the backoff wait
            (await db.scalars(select(Job))).one().run_after = func.now()
            await db.commit()
        assert await run_once(sessions, queue, handlers)
    assert await _status(db) == ("FAILED", "FAILED", "INTERNAL_ERROR")
    job = (await db.scalars(select(Job))).one()
    assert (job.attempts, job.result) == (3, None)
    assert await db.scalar(select(func.count()).select_from(ValidationRun)) == runs  # no PASS
    failed = await db.scalar(select(AuditEvent).where(AuditEvent.action == "document.failed"))
    assert failed is not None and failed.object_id == VERSION
    assert "INV-1042 text" not in caplog.text and "RuntimeError" in caplog.text
