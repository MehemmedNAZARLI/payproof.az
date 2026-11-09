import uuid
from collections.abc import Callable
from typing import Any

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.seed.fixtures import uid
from tests.api.test_contract import assert_matches
from tests.integration.factories import make_tenant, package

Auth = Callable[[str], dict[str, str]]
PDF = b"%PDF-1.7\n1 0 obj << /Type /Page >> endobj\n%%EOF"


async def _post(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    path: str,
    data: bytes,
    version: int | str,
    key: str | None = None,
    **form: str,
) -> httpx.Response:
    return await client.post(
        path,
        headers={**headers, "Idempotency-Key": key or str(uuid.uuid4())},
        data={"expected_version": str(version), **form},
        files={"file": ("INV-1035_v2.pdf", data, "application/pdf")},
    )


async def _version(client: httpx.AsyncClient, auth: Auth, pkg: str) -> int:
    r = await client.get(f"/v1/packages/{uid(pkg)}", headers=auth("u1"))
    v: int = r.json()["version"]
    return v


async def test_upload_replay_duplicate_and_download(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    path, key = f"/v1/packages/{uid('pkg_1035')}/documents", str(uuid.uuid4())
    version = await _version(client, auth, "pkg_1035")
    r = await _post(client, auth("u1"), path, PDF + b"api", version, key, type="invoice")
    assert r.status_code == 202, r.text
    accepted: dict[str, Any] = r.json()
    assert_matches("JobAccepted", accepted)
    replay = await _post(client, auth("u1"), path, PDF + b"api", version, key, type="invoice")
    assert (replay.status_code, replay.json()) == (202, accepted)
    assert await _version(client, auth, "pkg_1035") == version + 1

    dup = await _post(client, auth("u1"), path, PDF + b"api", version + 1, type="order")
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "DUPLICATE_FILE"
    assert_matches("Error", dup.json())

    link = await client.get(
        f"/v1/documents/versions/{accepted['document_version_id']}/file", headers=auth("u5")
    )
    assert link.status_code == 200
    assert_matches("SignedUrl", link.json())
    async with httpx.AsyncClient() as raw:
        assert (await raw.get(link.json()["url"])).content == PDF + b"api"


async def test_new_version_of_an_existing_document(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    detail = (await client.get(f"/v1/packages/{uid('pkg_1036')}", headers=auth("u1"))).json()
    delivery = next(d for d in detail["documents"] if d["type"] == "delivery")
    path = f"/v1/documents/{delivery['id']}/versions"
    r = await _post(client, auth("u1"), path, PDF + b"v4", detail["version"])
    assert r.status_code == 202, r.text
    assert r.json()["document_id"] == delivery["id"]


@pytest.mark.parametrize(
    ("user", "data", "version", "status", "code"),
    [
        ("u5", PDF, None, 403, "FORBIDDEN"),  # readonly cannot upload
        ("u1", b"MZ\x90\x00" + b"\0" * 60, None, 415, "UNSUPPORTED_FILE_TYPE"),  # .exe as .pdf
        ("u1", PDF + b"stale", 99, 409, "VERSION_CONFLICT"),
    ],
)
async def test_refusals(
    client: httpx.AsyncClient,
    seeded: AsyncSession,
    auth: Auth,
    user: str,
    data: bytes,
    version: int | None,
    status: int,
    code: str,
) -> None:
    path = f"/v1/packages/{uid('pkg_1035')}/documents"
    current = await _version(client, auth, "pkg_1035")
    r = await _post(client, auth(user), path, data, version or current, type="invoice")
    assert (r.status_code, r.json()["error"]["code"]) == (status, code)


async def test_other_company_and_missing_key(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    foreign = package(await make_tenant(seeded), "INV-X")
    seeded.add(foreign)
    await seeded.flush()
    path = f"/v1/packages/{foreign.id}/documents"
    assert (await _post(client, auth("u1"), path, PDF, 1, type="invoice")).status_code == 404
    other = f"/v1/documents/versions/{uuid.uuid4()}/file"
    assert (await client.get(other, headers=auth("u1"))).status_code == 404
    no_key = await client.post(
        f"/v1/packages/{uid('pkg_1035')}/documents",
        headers=auth("u1"),
        data={"expected_version": "1", "type": "invoice"},
        files={"file": ("a.pdf", PDF, "application/pdf")},
    )
    assert no_key.status_code == 400
