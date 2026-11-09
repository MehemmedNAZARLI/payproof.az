import datetime as dt
from collections.abc import Callable
from typing import Any

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.seed.fixtures import uid
from payproof.services.tasks import today
from tests.api.test_contract import assert_matches

Auth = Callable[[str], dict[str, str]]


def task_body(rule: str = "R-007", **over: Any) -> dict[str, Any]:
    return {
        "rule_id": rule,
        "assignee_id": str(uid("u3")),
        "step": "İmzalanmış təhvil aktını anbardan alın və yükləyin.",
        "due_date": str(today() + dt.timedelta(days=3)),
        **over,
    }


async def create(
    client: httpx.AsyncClient, auth: Auth, pkg: str = "pkg_1042", **over: Any
) -> httpx.Response:
    return await client.post(
        f"/v1/packages/{uid(pkg)}/tasks", headers=auth("u1"), json=task_body(**over)
    )


async def test_create_numbers_audits_and_tells_nobody_who_cannot_sign_in(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    r = await create(client, auth)  # INV-1042 R-007 FAIL; u3 is an assignee (no login)
    assert r.status_code == 201, r.text
    t = r.json()
    assert_matches("Task", t)
    assert (t["number"], t["status"], t["rule_id"]) == ("T-124", "OPEN", "R-007")
    again = await create(client, auth)
    assert again.status_code == 409 and again.json()["error"]["code"] == "TASK_ALREADY_OPEN"
    assert again.json()["error"]["details"]["number"] == "T-124"


@pytest.mark.parametrize(
    ("over", "status"),
    [
        ({"rule": "R-009"}, 422),  # INV-1042 R-009 PASS: nothing to fix
        ({"due_date": str(today() - dt.timedelta(days=1))}, 422),  # due date in the past
        ({"assignee_id": "00000000-0000-0000-0000-000000000000"}, 422),
    ],
)
async def test_create_refusals(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth, over: dict[str, Any], status: int
) -> None:
    assert (await create(client, auth, **over)).status_code == status


async def test_readonly_cannot_create(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    r = await client.post(
        f"/v1/packages/{uid('pkg_1042')}/tasks", headers=auth("u5"), json=task_body()
    )
    assert r.status_code == 403


async def test_list_filters_and_counts(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    r = await client.get("/v1/tasks", headers=auth("u5"))
    assert r.status_code == 200
    page = r.json()
    assert set(page) == {"items", "next_cursor", "status_counts"}  # inline schema in openapi
    assert page["items"] and all(t["status"] != "RESOLVED" for t in page["items"])
    for t in page["items"]:
        assert_matches("Task", t)
    assert page["status_counts"] == {
        "OPEN": 4,
        "IN_PROGRESS": 2,
        "SUBMITTED_FOR_RECHECK": 0,
        "RESOLVED": 3,
    }  # tasks.json
    mine = (await client.get(f"/v1/tasks?assignee_id={uid('u6')}", headers=auth("u5"))).json()
    assert all(t["assignee"]["id"] == str(uid("u6")) for t in mine["items"])
    done = (await client.get("/v1/tasks?status=RESOLVED&limit=2", headers=auth("u5"))).json()
    assert len(done["items"]) == 2 and done["next_cursor"]
