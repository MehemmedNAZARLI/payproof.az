from collections.abc import Callable
from typing import Any

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.seed.fixtures import EXPECTED, uid
from tests.integration.factories import make_tenant, package

Auth = Callable[[str], dict[str, str]]


async def _detail(
    client: httpx.AsyncClient, auth: Auth, pkg: str, user: str = "u1"
) -> dict[str, Any]:
    r = await client.get(f"/v1/packages/{uid(pkg)}", headers=auth(user))
    assert r.status_code == 200, r.text
    body: dict[str, Any] = r.json()
    return body


async def test_detail_of_inv_1042(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    d = await _detail(client, auth, "pkg_1042")
    assert (d["invoice_number"], d["status"], d["version"]) == ("INV-1042", "NEEDS_REVIEW", 1)
    assert d["summary"]["blocking"] == EXPECTED["packages"]["INV-1042"]["blockers"]
    assert {c["rule_id"]: c["outcome"] for c in d["checks"]} == EXPECTED["packages"]["INV-1042"][
        "checks"
    ]
    r001 = d["checks"][0]
    assert (r001["title"], r001["fix_hint"]) == ("Məcburi sifariş nömrəsi (PO)", "upload_invoice")
    link = d["link"]
    assert (link["confirmed"], link["order_id"], link["method"]) == (False, None, None)
    assert [c["po_number"] for c in link["candidates"]] == ["PO-381"]  # suggested, not chosen
    assert [doc["type"] for doc in d["documents"]] == ["invoice", "order"]
    assert d["fields"][0]["field_path"] == "invoice.po_ref"
    assert d["requirement_set"]["version"] == 2
    assert d["permissions"] == {
        "can_edit": True, "can_manage_tasks": True, "can_approve": False,
        "can_export": False, "can_delete": True,
    }  # fmt: skip
    assert "pass" in d["summary"]


async def test_exported_package_and_its_records(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    d = await _detail(client, auth, "pkg_1033", user="u2")
    assert d["status"] == "EXPORTED"
    assert d["current_approval"] is not None and d["current_approval"]["valid"]
    assert d["exports"][0]["files"][0]["type"] in ("invoice", "order", "delivery")
    assert d["permissions"]["can_approve"] is False  # exported, nothing to approve
    keys = [row["key"] for row in d["comparison"]["rows"]]
    assert keys[:3] == ["po_ref", "customer", "currency"] and keys[-1] == "total"


async def test_ready_package_can_be_approved_by_approver_only(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    approver = await _detail(client, auth, "pkg_1038", user="u2")
    assert approver["status"] == "READY_FOR_APPROVAL" and approver["permissions"]["can_approve"]
    operator = await _detail(client, auth, "pkg_1038", user="u1")
    assert operator["permissions"]["can_approve"] is False


async def test_processing_package_has_no_checks_or_comparison(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    d = await _detail(client, auth, "pkg_1050")
    assert (d["status"], d["checks"], d["comparison"]["rows"], d["total"]) == (
        "PROCESSING",
        [],
        [],
        None,
    )
    assert d["permissions"]["can_edit"] is False


async def test_invalidated_approval_stays_in_history(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    d = await _detail(client, auth, "pkg_1036")
    assert d["current_approval"] is None
    assert [(a["package_version"], a["valid"]) for a in d["approvals"]] == [(2, False)]


@pytest.mark.parametrize("case", ["unknown", "other-tenant"])
async def test_not_found(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth, case: str
) -> None:
    if case == "unknown":
        target = uid("nope")
    else:
        other = await make_tenant(seeded)
        foreign = package(other, "INV-X")
        seeded.add(foreign)
        await seeded.flush()
        target = foreign.id
    r = await client.get(f"/v1/packages/{target}", headers=auth("u1"))
    assert (r.status_code, r.json()["error"]["code"]) == (404, "NOT_FOUND")
