from collections.abc import Callable
from typing import Any

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.seed.extraction import field_id
from payproof.seed.fixtures import uid
from tests.api.test_contract import assert_matches

Auth = Callable[[str], dict[str, str]]
PO = field_id("pkg_1047", "invoice.po_ref")


async def _patch(client: httpx.AsyncClient, auth: Auth, body: dict[str, Any]) -> httpx.Response:
    return await client.patch(f"/v1/fields/{PO}", headers=auth("u1"), json=body)


async def test_inv_1047_po_correction_makes_it_ready(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    body = {"value": "PO-397", "reason": "Skanda PO mənbəyə baxaraq təsdiqləndi"}
    r = await _patch(client, auth, {**body, "expected_version": 1})
    assert r.status_code == 200, r.text
    d = r.json()
    assert_matches("PackageDetail", d)
    assert (d["status"], d["version"]) == ("READY_FOR_APPROVAL", 2)
    po = next(f for f in d["fields"] if f["field_path"] == "invoice.po_ref")
    assert (po["value"], po["raw_value"], po["review_status"]) == ("PO-397", "PO-3?7", "CORRECTED")
    audit = (await client.get(f"/v1/packages/{uid('pkg_1047')}/audit", headers=auth("u1"))).json()
    corrected = next(e for e in audit["items"] if e["action"] == "field.corrected")
    assert corrected["message"] == (
        "invoice.po_ref: “PO-3?7 (oxunmur)” → “PO-397” · səbəb: Skanda PO mənbəyə baxaraq "
        "təsdiqləndi · sənədin özü dəyişmədi"
    )
    assert corrected["actor"]["id"] == str(uid("u1"))


@pytest.mark.parametrize(
    ("body", "status"),
    [
        ({"value": "PO-397", "expected_version": 1}, 422),  # no reason
        ({"value": "PO-397", "reason": "ok", "expected_version": 1}, 422),  # too short
        ({"value": "397", "reason": "mənbəyə baxıldı", "expected_version": 1}, 422),
        ({"value": "PO-397", "reason": "mənbəyə baxıldı", "expected_version": 5}, 409),
    ],
)
async def test_refusals(
    client: httpx.AsyncClient,
    seeded: AsyncSession,
    auth: Auth,
    body: dict[str, Any],
    status: int,
) -> None:
    assert (await _patch(client, auth, body)).status_code == status


async def test_line_values_must_be_positive(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    qty = field_id("pkg_1047", "invoice.lines[GY-1L].qty")
    body = {"value": "-3", "reason": "mənbəyə baxıldı", "expected_version": 1}
    r = await client.patch(f"/v1/fields/{qty}", headers=auth("u1"), json=body)
    assert r.status_code == 422
    readonly = await client.patch(f"/v1/fields/{qty}", headers=auth("u5"), json=body)
    assert readonly.status_code == 403
