from collections.abc import Callable
from typing import Any

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.seed.fixtures import EXPECTED, uid

Auth = Callable[[str], dict[str, str]]


async def _list(client: httpx.AsyncClient, auth: Auth, query: str = "") -> dict[str, Any]:
    r = await client.get(f"/v1/packages{query}", headers=auth("u1"))
    assert r.status_code == 200, r.text
    page: dict[str, Any] = r.json()
    return page


def _numbers(page: dict[str, Any]) -> list[str]:
    return [i["invoice_number"] for i in page["items"]]


async def test_list_item_shape(client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth) -> None:
    page = await _list(client, auth, "?q=INV-1042")
    item = page["items"][0]
    assert item["status"] == "NEEDS_REVIEW"
    assert item["total"] == {"amount": "12000.00", "currency": "AZN"}
    assert item["blocking"] == EXPECTED["packages"]["INV-1042"]["blockers"]
    assert item["customer"] == {"id": str(uid("c1")), "name": "B Mağazalar Şəbəkəsi"}
    assert item["owner"]["full_name"] == "Aygün Məmmədova"
    assert (page["total_count"], page["next_cursor"]) == (1, None)


async def test_filters(client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth) -> None:
    fix = _numbers(await _list(client, auth, "?status=NEEDS_FIX,NEEDS_REVIEW&sort=invoice_number"))
    expected = sorted(
        n for n, x in EXPECTED["packages"].items() if x["status"] in ("NEEDS_FIX", "NEEDS_REVIEW")
    )
    assert fix == expected
    by_issue = _numbers(await _list(client, auth, "?issue=R-005"))
    assert by_issue == ["INV-1044"]
    usd_customer = _numbers(await _list(client, auth, f"?customer_id={uid('c2')}"))
    assert usd_customer and all(n in EXPECTED["packages"] for n in usd_customer)
    po = _numbers(await _list(client, auth, "?q=po-377"))  # case-insensitive, matches the order PO
    assert po == ["INV-1038"]
    dated = _numbers(await _list(client, auth, "?from=2026-11-03&to=2026-11-03"))
    assert "INV-1042" in dated


async def test_sort_and_cursor_pages(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    first = await _list(client, auth, "?sort=-invoice_number&limit=5")
    assert len(first["items"]) == 5 and first["total_count"] == 14
    second = await _list(
        client, auth, f"?sort=-invoice_number&limit=5&cursor={first['next_cursor']}"
    )
    everything = _numbers(await _list(client, auth, "?sort=-invoice_number"))
    assert _numbers(first) + _numbers(second) == everything[:10]
    assert everything == sorted(everything, reverse=True)


async def test_longest_waiting_problem_first(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    # web Overview asks `sort=-problem_age` for "open problems that have waited longest"
    page = await _list(client, auth, "?sort=-problem_age")
    statuses = [i["status"] for i in page["items"]]
    assert page["items"][0]["invoice_number"] == "INV-1042"  # problem since 2026-11-03
    open_count = sum(s in ("NEEDS_FIX", "NEEDS_REVIEW") for s in statuses)
    assert all(s in ("NEEDS_FIX", "NEEDS_REVIEW") for s in statuses[:open_count])
    since = [i["problem_since"] for i in page["items"][:open_count]]
    assert since == sorted(since)  # oldest first


@pytest.mark.parametrize(
    "query",
    ["?status=PAID", "?sort=price", "?limit=0", "?limit=201", "?q=" + "x" * 101, "?cursor=%%%"],
)
async def test_invalid_query_is_400(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth, query: str
) -> None:
    r = await client.get(f"/v1/packages{query}", headers=auth("u1"))
    assert (r.status_code, r.json()["error"]["code"]) == (400, "VALIDATION_ERROR")


async def test_dashboard_endpoint(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    r = await client.get("/v1/dashboard", headers=auth("u5"))  # readonly may view
    assert r.status_code == 200
    assert r.json()["status_counts"] == EXPECTED["dashboard"]["status_counts"]
    assert (await client.get("/v1/dashboard")).status_code == 401
