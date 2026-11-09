import uuid
from collections.abc import Callable

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.seed.files import placeholder
from payproof.seed.fixtures import uid
from tests.api.test_contract import assert_matches

Auth = Callable[[str], dict[str, str]]


async def _create(client: httpx.AsyncClient, auth: Auth, key: str) -> httpx.Response:
    return await client.post(
        "/v1/packages",
        headers={**auth("u1"), "Idempotency-Key": key},
        data={"customer_id": str(uid("c1")), "owner_id": str(uid("u1"))},
        files={
            "invoice": ("INV-1052.pdf", placeholder("INV-1052.pdf"), "application/pdf"),
            "order": ("PO-400.pdf", placeholder("PO-400.pdf"), "application/pdf"),
        },
    )


async def test_create_replay_duplicate_and_delete(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    key = str(uuid.uuid4())
    r = await _create(client, auth, key)
    assert r.status_code == 202, r.text
    assert_matches("JobAccepted", r.json())
    assert (await _create(client, auth, key)).json() == r.json()  # same key: replayed
    dup = await _create(client, auth, str(uuid.uuid4()))
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "DUPLICATE_INVOICE"

    pid = r.json()["package_id"]
    detail = (await client.get(f"/v1/packages/{pid}", headers=auth("u1"))).json()
    assert (detail["status"], detail["invoice_number"]) == ("PROCESSING", "INV-1052")
    assert (await client.delete(f"/v1/packages/{pid}", headers=auth("u5"))).status_code == 403
    assert (await client.delete(f"/v1/packages/{pid}", headers=auth("u1"))).status_code == 204
    assert (await client.get(f"/v1/packages/{pid}", headers=auth("u1"))).status_code == 404
    audit = (await client.get(f"/v1/audit?package_id={pid}", headers=auth("u1"))).json()
    assert audit["items"][0]["action"] == "package.deleted"  # the history stays


async def test_approved_or_ready_package_is_not_deleted(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    for pkg in ("pkg_1035", "pkg_1038"):  # approved / ready for approval
        r = await client.delete(f"/v1/packages/{uid(pkg)}", headers=auth("u1"))
        assert r.status_code == 409 and r.json()["error"]["code"] == "PACKAGE_NOT_DELETABLE"
