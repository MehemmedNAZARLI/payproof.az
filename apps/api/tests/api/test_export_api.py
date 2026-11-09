import uuid
from collections.abc import Callable

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.base import bind_tenant
from payproof.repositories.models import AuditEvent, DocumentVersion
from payproof.seed.files import store_placeholders
from payproof.seed.fixtures import uid
from payproof.seed.identity import COMPANY_ID
from payproof.seed.packages import version_id
from payproof.storage.s3 import get_storage
from tests.api.test_contract import assert_matches

Auth = Callable[[str], dict[str, str]]
PATH = f"/v1/packages/{uid('pkg_1035')}"


async def _export(
    client: httpx.AsyncClient, auth: Auth, key: str, user: str = "u1"
) -> httpx.Response:
    detail = (await client.get(PATH, headers=auth("u1"))).json()
    body = {
        "expected_version": detail["version"],
        "expected_requirement_set_version": detail["requirement_set"]["version"],
        "document_version_ids": [str(version_id("pkg_1035", "invoice", 1))],
    }
    return await client.post(
        f"{PATH}/export", headers={**auth(user), "Idempotency-Key": key}, json=body
    )


async def test_export_replay_and_report(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    bind_tenant(seeded, COMPANY_ID)
    await store_placeholders(get_storage(), (await seeded.scalars(select(DocumentVersion))).all())
    key = str(uuid.uuid4())
    first = await _export(client, auth, key)
    assert first.status_code == 200, first.text
    assert_matches("ExportResult", first.json())
    events = await seeded.scalar(
        select(func.count()).select_from(AuditEvent).where(AuditEvent.action == "export.created")
    )
    again = await _export(client, auth, key)  # same key: same export, a new signature
    assert again.json()["export"] == first.json()["export"]
    assert again.json()["download"]["expires_at"] >= first.json()["download"]["expires_at"]
    async with httpx.AsyncClient() as raw:
        assert (await raw.get(again.json()["download"]["url"])).status_code == 200
    assert (
        await seeded.scalar(
            select(func.count())
            .select_from(AuditEvent)
            .where(AuditEvent.action == "export.created")
        )
    ) == events  # no new event
    assert (await _export(client, auth, str(uuid.uuid4()), user="u5")).status_code == 403

    report = await client.get(f"{PATH}/internal-report", headers=auth("u5"))
    assert report.status_code == 200
    assert_matches("InternalReport", report.json())
    assert report.json()["status"] == "EXPORTED" and report.json()["exports"]
