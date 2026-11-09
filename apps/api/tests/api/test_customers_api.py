from collections.abc import Callable
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.seed.fixtures import uid
from tests.api.test_contract import assert_matches

Auth = Callable[[str], dict[str, str]]
C2 = f"/v1/customers/{uid('c2')}/requirements"


def _body(**over: Any) -> dict[str, Any]:
    return {
        "require_po": True,
        "require_delivery": True,
        "require_signature": True,
        "tolerance": "0.01",
        "effective_from": "2026-12-01",
        "reason": "Müştəri dekabrdan imzalı təhvil aktı tələb edir.",
        "expected_version": 1,
        **over,
    }


async def test_customers_and_rule_sets(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    r = await client.get("/v1/customers", headers=auth("u5"))
    assert r.status_code == 200
    for c in r.json()["items"]:
        assert_matches("Customer", c)
    assert (await client.post(C2, headers=auth("u1"), json=_body())).status_code == 403
    created = await client.post(C2, headers=auth("u2"), json=_body())
    assert created.status_code == 201, created.text
    assert_matches("RequirementSet", created.json())
    assert created.json()["version"] == 2
    history = (await client.get(C2, headers=auth("u5"))).json()["items"]
    assert [s["version"] for s in history] == [2, 1]
    detail = (await client.get(f"/v1/packages/{uid('pkg_1035')}", headers=auth("u2"))).json()
    assert (detail["status"], detail["version"]) == ("NEEDS_REVIEW", 2)


async def test_rule_set_validation(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    same = await client.post(C2, headers=auth("u2"), json=_body(require_signature=False))
    assert same.status_code == 422  # nothing changed
    assert (
        await client.post(C2, headers=auth("u2"), json=_body(tolerance="1.50"))
    ).status_code == 400
    assert (await client.post(C2, headers=auth("u2"), json=_body(reason="qısa"))).status_code == 400
    assert (
        await client.post(C2, headers=auth("u2"), json=_body(expected_version=3))
    ).status_code == 409
