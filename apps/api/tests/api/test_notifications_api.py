from collections.abc import Callable
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from tests.api.test_contract import assert_matches

Auth = Callable[[str], dict[str, str]]


async def _page(client: httpx.AsyncClient, auth: Auth, user: str, q: str = "") -> dict[str, Any]:
    r = await client.get(f"/v1/notifications{q}", headers=auth(user))
    assert r.status_code == 200
    body: dict[str, Any] = r.json()
    return body


async def test_only_my_notifications_and_reading_them(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    mine = await _page(client, auth, "u2")  # the approver has seeded notifications
    assert mine["items"] and mine["unread_count"] >= 1
    for n in mine["items"]:
        assert_matches("Notification", n)
    others = {n["id"] for n in (await _page(client, auth, "u1"))["items"]}
    assert others.isdisjoint(n["id"] for n in mine["items"])  # no one sees another's

    first = next(n["id"] for n in mine["items"] if n["read_at"] is None)
    assert (
        await client.post(f"/v1/notifications/{first}/read", headers=auth("u1"))
    ).status_code == 404
    for _ in range(2):  # idempotent
        r = await client.post(f"/v1/notifications/{first}/read", headers=auth("u2"))
        assert r.status_code == 204
    assert (await _page(client, auth, "u2"))["unread_count"] == mine["unread_count"] - 1

    assert (await client.post("/v1/notifications/read-all", headers=auth("u2"))).status_code == 204
    after = await _page(client, auth, "u2", "?unread_only=true")
    assert (after["unread_count"], after["items"]) == (0, [])
    assert (await client.get("/v1/notifications")).status_code == 401
