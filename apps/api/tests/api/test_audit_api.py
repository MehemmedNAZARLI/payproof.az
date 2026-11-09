import csv
import io
from collections.abc import Callable
from typing import Any

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.seed.fixtures import uid
from tests.api.test_contract import assert_matches
from tests.integration.factories import make_tenant, package

Auth = Callable[[str], dict[str, str]]


async def _get(client: httpx.AsyncClient, auth: Auth, path: str) -> dict[str, Any]:
    r = await client.get(path, headers=auth("u5"))  # readonly may read the audit log
    assert r.status_code == 200, r.text
    body: dict[str, Any] = r.json()
    return body


async def test_package_audit_newest_first(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    page = await _get(client, auth, f"/v1/packages/{uid('pkg_1036')}/audit")
    assert_matches("AuditPage", page)
    times = [e["created_at"] for e in page["items"]]
    assert times == sorted(times, reverse=True)
    actions = [e["action"] for e in page["items"]]
    assert "approval.invalidated" in actions and actions[-1] == "package.created"
    invalidated = next(e for e in page["items"] if e["action"] == "approval.invalidated")
    assert invalidated["actor"] is None and invalidated["package"]["invoice_number"] == "INV-1036"


async def test_company_audit_filters_and_pages(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    system = await _get(client, auth, "/v1/audit?actor_id=system&limit=200")
    assert system["items"] and all(e["actor"] is None for e in system["items"])
    mine = await _get(client, auth, f"/v1/audit?actor_id={uid('u2')}&limit=200")
    assert {e["actor"]["full_name"] for e in mine["items"]} == {"Rəşad Əliyev"}
    found = await _get(client, auth, "/v1/audit?q=inv-1048")  # invoice number, any case
    assert found["items"] and all(
        e["package"]["invoice_number"] == "INV-1048" for e in found["items"]
    )
    by_name = await _get(client, auth, "/v1/audit?q=sistem&limit=1")
    assert by_name["items"][0]["actor"] is None
    first = await _get(client, auth, "/v1/audit?limit=5")
    second = await _get(client, auth, f"/v1/audit?limit=5&cursor={first['next_cursor']}")
    assert {e["id"] for e in first["items"]}.isdisjoint(e["id"] for e in second["items"])
    window = await _get(
        client, auth, "/v1/audit?from=2026-11-06T00:00:00Z&to=2026-11-07T00:00:00Z&limit=200"
    )
    assert all("2026-11-06" <= e["created_at"] < "2026-11-07" for e in window["items"])


async def test_csv_opens_in_excel(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    r = await client.get("/v1/audit?format=csv&q=INV-1036", headers=auth("u1"))
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    raw = r.content
    assert raw.startswith("﻿".encode())  # BOM: Excel reads UTF-8 (ə, ı, ş)
    rows = list(csv.reader(io.StringIO(raw.decode("utf-8-sig"))))
    assert rows[0] == [
        "created_at",
        "actor",
        "action",
        "invoice_number",
        "package_version",
        "message",
    ]
    assert any(row[1] == "Sistem" and "qüvvədən düşdü" in row[5] for row in rows[1:])


@pytest.mark.parametrize("case", ["unknown", "other-tenant"])
async def test_package_audit_not_found(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth, case: str
) -> None:
    target = uid("nope")
    if case == "other-tenant":
        foreign = package(await make_tenant(seeded), "INV-X")
        seeded.add(foreign)
        await seeded.flush()
        target = foreign.id
    r = await client.get(f"/v1/packages/{target}/audit", headers=auth("u1"))
    assert r.status_code == 404


@pytest.mark.parametrize(
    ("query", "status"),  # 400 = malformed (framework), 422 = well-formed but not acceptable
    [("?actor_id=bob", 422), ("?format=xml", 400), ("?q=" + "x" * 101, 400)],
)
async def test_invalid_filters(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth, query: str, status: int
) -> None:
    r = await client.get(f"/v1/audit{query}", headers=auth("u1"))
    assert r.status_code == status and r.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_needs_a_token(client: httpx.AsyncClient) -> None:
    assert (await client.get("/v1/audit")).status_code == 401


def test_csv_cells_cannot_become_formulas() -> None:
    from payproof.services.audit_query import _cell

    assert _cell('=HYPERLINK("x")') == '"\'=HYPERLINK(""x"")"'
    assert _cell("-1") == '"\'-1"' and _cell(None) == '""' and _cell(3) == '"3"'
