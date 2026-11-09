import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.models import IdempotencyKey, Job, Notification
from tests.integration.factories import Tenant, add, add_fails, package


async def test_notification_for_member(db: AsyncSession, a: Tenant, b: Tenant) -> None:
    pkg = package(a)
    await add(db, pkg)
    note = Notification(company_id=a.company.id, user_id=a.user.id, package_id=pkg.id, text="Hazır")
    await add(db, note)
    assert note.read_at is None
    await add_fails(db, Notification(company_id=a.company.id, user_id=b.user.id, text="x"))
    await add_fails(db, Notification(company_id=a.company.id, user_id=a.user.id, text=""))


def _job(t: Tenant, **over: object) -> Job:
    fields: dict[str, object] = {"kind": "extract_document", "payload": {"package_version": 1}}
    fields.update(over)
    return Job(company_id=t.company.id, **fields)


async def test_job_defaults_and_worker_can_see_all_tenants(
    db: AsyncSession, a: Tenant, b: Tenant
) -> None:
    job = _job(a)
    await add(db, job, _job(b))
    await db.refresh(job)
    assert (job.status, job.attempts, job.max_attempts, job.locked_at) == ("QUEUED", 0, 3, None)
    # the worker claims jobs across tenants without bind_tenant (B-14 filters API reads)
    queued = (await db.scalars(select(Job).where(Job.status == "QUEUED"))).all()
    assert {j.company_id for j in queued} >= {a.company.id, b.company.id}


@pytest.mark.parametrize(
    "over",
    [
        {"kind": "send_email"},
        {"status": "DONE"},
        {"attempts": 4},
        {"max_attempts": 0},
        {"status": "FAILED"},  # a failed job always says why
        {"payload": [1]},
    ],
    ids=["kind", "status", "attempts", "max", "failed-code", "payload"],
)
async def test_job_checks(db: AsyncSession, a: Tenant, over: dict[str, object]) -> None:
    await add_fails(db, _job(a, **over))


def _key(t: Tenant, key: str = "k-1", **over: object) -> IdempotencyKey:
    fields: dict[str, object] = {"endpoint": "approve", "request_hash": "a" * 64}
    fields.update(over)
    return IdempotencyKey(company_id=t.company.id, key=key, **fields)


async def test_idempotency_key_unique_per_endpoint(db: AsyncSession, a: Tenant, b: Tenant) -> None:
    await add(db, _key(a), _key(b), _key(a, endpoint="export"))  # in progress: no response yet
    await add_fails(db, _key(a))


async def test_idempotency_response_is_complete(db: AsyncSession, a: Tenant) -> None:
    await add(db, _key(a, status_code=200, response={"id": "x"}))
    await add_fails(db, _key(a, "k-2", status_code=200))  # half-written response
    await add_fails(db, _key(a, "k-3", request_hash="nope"))
    await add_fails(db, _key(a, "x" * 256))
