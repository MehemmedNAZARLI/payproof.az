from collections.abc import Callable

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.errors import ErrorCode
from payproof.seed.identity import COMPANY_ID
from payproof.worker.queue import PostgresQueue
from tests.api.test_contract import assert_matches
from tests.integration.factories import make_tenant

Auth = Callable[[str], dict[str, str]]
queue = PostgresQueue()


async def test_own_job_matches_the_contract(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    job = await queue.enqueue(seeded, company_id=COMPANY_ID, kind="extract_document", payload={})
    r = await client.get(f"/v1/jobs/{job.id}", headers=auth("u5"))
    assert r.status_code == 200
    assert_matches("Job", r.json())
    assert (r.json()["status"], r.json()["result"], r.json()["error"]) == ("QUEUED", None, None)

    assert await queue.claim(seeded) is job
    job.attempts = job.max_attempts
    await queue.fail(seeded, job, ErrorCode.INTERNAL_ERROR)
    failed = (await client.get(f"/v1/jobs/{job.id}", headers=auth("u5"))).json()
    assert_matches("Job", failed)
    assert failed["status"] == "FAILED" and failed["error"]["code"] == "INTERNAL_ERROR"


async def test_other_company_job_is_not_found(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    other = await make_tenant(seeded)
    job = await queue.enqueue(
        seeded, company_id=other.company.id, kind="extract_document", payload={}
    )
    assert (await client.get(f"/v1/jobs/{job.id}", headers=auth("u1"))).status_code == 404
    assert (await client.get(f"/v1/jobs/{job.id}")).status_code == 401
