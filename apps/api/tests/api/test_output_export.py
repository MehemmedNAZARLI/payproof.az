"""ADR-0011 §4 end to end on the seeded UNEC settlement: approve → export fills the template only
from validated values (manifest cites each source) → e-mail job to the set's address."""

import io
import json
import uuid
import zipfile
from collections.abc import Callable
from typing import Any

import httpx
import httpx2
import pytest
from docx import Document as Docx
from pydantic import SecretStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.settings import get_settings
from payproof.repositories.base import bind_tenant
from payproof.repositories.models import AuditEvent, ExportRecord, GenericExtraction, Job
from payproof.seed.fixtures import uid
from payproof.seed.identity import COMPANY_ID
from payproof.services.submission import SubmissionFailed, send_export, send_failed
from payproof.storage.s3 import get_storage
from tests.api.test_contract import assert_matches

Auth = Callable[[str], dict[str, str]]
PKG = uid("unec_0914")
VERSIONS = [uid(f"unec_0914_{d}:v1") for d in
            ("ke2231", "tm88017", "ol5520", "bank_statement", "card_statement")]  # fmt: skip


async def _post(client: httpx.AsyncClient, auth: Auth, action: str, user: str, **body: Any) -> Any:
    headers = {**auth(user), "Idempotency-Key": str(uuid.uuid4())}
    payload = {"expected_version": 1, "expected_requirement_set_version": 1, **body}
    return await client.post(f"/v1/packages/{PKG}/{action}", headers=headers, json=payload)


async def _export(client: httpx.AsyncClient, auth: Auth, ids: list[uuid.UUID] = VERSIONS) -> Any:
    return await _post(client, auth, "export", "u1", document_version_ids=[str(i) for i in ids])


async def test_export_fills_the_template_and_queues_the_email(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    assert (await _post(client, auth, "approve", "u2", documents_reviewed=True)).status_code == 200
    assert (await _export(client, auth, VERSIONS[:3])).status_code == 422  # statements missing
    r = await _export(client, auth)
    assert r.status_code == 200, r.text
    out = r.json()["export"]
    assert_matches("ExportRecord", out)
    values = {v["placeholder"]: v["value"] for v in out["output"]["values"]}
    assert values["{{grantee_fin}}"] == "5ZK8M2P" and values["{{total_spent}}"] == "1290.00 AZN"
    assert values["{{approved_by}}"] == "Rəşad Əliyev"
    assert out["output"]["submission"] == {"address": "qrant-hesabat@unec.test",
                                           "status": "QUEUED", "attempted_at": None}  # fmt: skip
    bind_tenant(seeded, COMPANY_ID)
    rec = await seeded.get_one(ExportRecord, uuid.UUID(out["id"]))
    zipped = zipfile.ZipFile(io.BytesIO(await get_storage().get(
        rec.manifest_key.rsplit("/", 1)[0] + "/package.zip")))  # fmt: skip
    name = out["output"]["template_file_name"]
    text = "\n".join(p.text for p in Docx(io.BytesIO(zipped.read(name))).paragraphs)
    assert "Qrant alan: Leyla Həsənova (FİN 5ZK8M2P)" in text and "{{" not in text
    manifest = json.loads(zipped.read("manifest.json"))
    fin = next(v for v in manifest["output"]["values"] if v["placeholder"] == "{{grantee_fin}}")
    assert fin["evidence"][0]["quote"] and fin["source"]["kind"] == "field"
    job = await seeded.scalar(select(Job).where(Job.kind == "send_export"))
    assert job is not None and job.payload == {"export_id": out["id"]}


async def test_missing_value_refuses_with_the_placeholders(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    assert (await _post(client, auth, "approve", "u2", documents_reviewed=True)).status_code == 200
    bind_tenant(seeded, COMPANY_ID)  # simulate the reference's export_refusal: holder unread
    row = await seeded.scalar(select(GenericExtraction).where(
        GenericExtraction.document_version_id == uid("unec_0914_bank_statement:v1")))  # fmt: skip
    assert row is not None
    row.fields = {**row.fields, "account_holder": None}
    row.unreadable = ["account_holder"]
    await seeded.flush()
    r = await _export(client, auth)
    assert r.status_code == 422
    missing = r.json()["error"]["details"]["missing_placeholders"]
    assert [m["placeholder"] for m in missing] == ["{{grantee_name}}", "{{grantee_fin}}"]
    assert await seeded.scalar(select(ExportRecord).where(ExportRecord.package_id == PKG)) is None


async def _queued(client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth) -> Job:
    await _post(client, auth, "approve", "u2", documents_reviewed=True)
    await _export(client, auth)
    bind_tenant(seeded, COMPANY_ID)
    job = await seeded.scalar(select(Job).where(Job.kind == "send_export"))
    assert job is not None
    return job


async def test_resend_request_is_bounded_and_idempotent(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth, monkeypatch: pytest.MonkeyPatch
) -> None:
    job = await _queued(client, seeded, auth)
    seen: list[httpx2.Request] = []

    def handler(request: httpx2.Request) -> httpx2.Response:
        seen.append(request)
        return httpx2.Response(200, json={"id": "re_123"})

    key = get_settings().model_copy(update={"resend_api_key": SecretStr("re_test")})
    monkeypatch.setattr("payproof.services.submission.get_settings", lambda: key)
    fake = httpx2.AsyncClient(base_url="https://api.resend.test",
                              transport=httpx2.MockTransport(handler))  # fmt: skip
    await send_export(seeded, get_storage(), job, fake)
    await send_export(seeded, get_storage(), job, fake)  # already SENT: nothing more
    [req] = seen
    body = json.loads(req.content)
    assert body["to"] == ["qrant-hesabat@unec.test"] and body["attachments"][0]["filename"]
    assert req.headers["Idempotency-Key"] == f"export-{job.payload['export_id']}"
    rec = await seeded.get_one(ExportRecord, uuid.UUID(job.payload["export_id"]))
    assert rec.output is not None and rec.output["submission"]["status"] == "SENT"


async def test_failed_submission_keeps_the_export(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth, monkeypatch: pytest.MonkeyPatch
) -> None:
    job = await _queued(client, seeded, auth)
    key = get_settings().model_copy(update={"resend_api_key": SecretStr("re_test")})
    monkeypatch.setattr("payproof.services.submission.get_settings", lambda: key)
    down = httpx2.MockTransport(lambda r: httpx2.Response(503))
    fake = httpx2.AsyncClient(base_url="https://api.resend.test", transport=down)
    with pytest.raises(SubmissionFailed, match="503"):
        await send_export(seeded, get_storage(), job, fake)
    await send_failed(seeded, job)
    rec = await seeded.get_one(ExportRecord, uuid.UUID(job.payload["export_id"]))
    assert rec.output is not None and rec.output["submission"]["status"] == "FAILED"
    actions = (await seeded.scalars(select(AuditEvent.action).where(
        AuditEvent.package_id == PKG))).all()  # fmt: skip
    assert "export.created" in actions and "export.send_failed" in actions


async def test_without_a_key_dev_only_logs(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    job = await _queued(client, seeded, auth)
    assert (await send_export(seeded, get_storage(), job))["status"] == "SENT"
    event = await seeded.scalar(select(AuditEvent).where(AuditEvent.action == "export.sent"))
    assert event is not None and "yalnız log" in event.message
