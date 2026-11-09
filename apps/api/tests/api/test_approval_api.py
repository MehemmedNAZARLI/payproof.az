import uuid
from collections.abc import Callable
from typing import Any

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.base import bind_tenant
from payproof.repositories.models import ApprovalRecord, AuditEvent
from payproof.seed.fixtures import uid
from payproof.seed.identity import COMPANY_ID
from tests.api.test_contract import assert_matches

Auth = Callable[[str], dict[str, str]]


async def approve(
    client: httpx.AsyncClient, auth: Auth, pkg: str, user: str = "u2", key: str | None = None,
    **over: Any,
) -> httpx.Response:  # fmt: skip
    detail = (await client.get(f"/v1/packages/{uid(pkg)}", headers=auth("u2"))).json()
    body = {
        "expected_version": detail["version"],
        "expected_requirement_set_version": detail["requirement_set"]["version"],
        "documents_reviewed": True,
        **over,
    }
    headers = {**auth(user), "Idempotency-Key": key or str(uuid.uuid4())}
    return await client.post(f"/v1/packages/{uid(pkg)}/approve", headers=headers, json=body)


async def _count(db: AsyncSession, model: Any, *where: Any) -> int:
    bind_tenant(db, COMPANY_ID)
    return int(await db.scalar(select(func.count()).select_from(model).where(*where)) or 0)


async def test_ready_package_is_approved_once(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    r = await approve(client, auth, "pkg_1038")  # READY_FOR_APPROVAL
    assert r.status_code == 200, r.text
    assert_matches("ApprovalRecord", r.json())
    detail = (await client.get(f"/v1/packages/{uid('pkg_1038')}", headers=auth("u2"))).json()
    assert detail["status"] == "APPROVED_READY"
    audits = await _count(seeded, AuditEvent, AuditEvent.action == "approval.created")
    again = await approve(client, auth, "pkg_1038")  # new key, same version: the same approval
    assert (again.status_code, again.json()) == (200, r.json())
    assert await _count(seeded, AuditEvent, AuditEvent.action == "approval.created") == audits
    pkg = uid("pkg_1038")
    assert await _count(seeded, ApprovalRecord, ApprovalRecord.package_id == pkg) == 1


async def test_refusals(client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth) -> None:
    assert (await approve(client, auth, "pkg_1038", user="u1")).status_code == 403  # operator
    blocked = await approve(client, auth, "pkg_1042")  # R-001, R-002, R-007 block it
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "PACKAGE_NOT_READY"
    assert [b["rule_id"] for b in blocked.json()["error"]["details"]["blocking"]] == [
        "R-001",
        "R-002",
        "R-007",
    ]
    stale = await approve(client, auth, "pkg_1038", expected_version=9)
    assert stale.json()["error"]["code"] == "VERSION_CONFLICT"
    rules = await approve(client, auth, "pkg_1038", expected_requirement_set_version=1)
    assert rules.status_code == 409  # a rule set the approver has not seen
    unread = await approve(client, auth, "pkg_1038", documents_reviewed=False)
    assert unread.status_code == 400
