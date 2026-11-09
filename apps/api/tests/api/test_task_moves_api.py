from collections.abc import Callable
from typing import Any

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from tests.api.test_contract import assert_matches
from tests.api.test_tasks_api import create

Auth = Callable[[str], dict[str, str]]


async def _patch(client: httpx.AsyncClient, auth: Auth, tid: str, **body: Any) -> httpx.Response:
    return await client.patch(f"/v1/tasks/{tid}", headers=auth("u1"), json=body)


@pytest.mark.parametrize(
    ("path", "last_status"),
    [
        (["IN_PROGRESS"], 200),
        (["IN_PROGRESS", "SUBMITTED_FOR_RECHECK"], 200),
        (["SUBMITTED_FOR_RECHECK"], 422),  # skips IN_PROGRESS
        (["IN_PROGRESS", "OPEN"], 422),  # no way back
        (["RESOLVED"], 422),  # only the system resolves
        (["IN_PROGRESS", "IN_PROGRESS"], 200),  # same status: nothing moves
    ],
)
async def test_transition_matrix(
    client: httpx.AsyncClient,
    seeded: AsyncSession,
    auth: Auth,
    path: list[str],
    last_status: int,
) -> None:
    tid = (await create(client, auth)).json()["id"]
    for i, status in enumerate(path):
        r = await _patch(client, auth, tid, status=status)
        expected = last_status if i == len(path) - 1 else 200
        assert r.status_code == expected, (path, r.text)
    if last_status == 422:
        assert r.json()["error"]["code"] == "TASK_STATUS_NOT_ALLOWED"
    else:
        assert_matches("Task", r.json())


async def test_submitting_rechecks_and_the_failing_rule_sends_it_back(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    tid = (await create(client, auth)).json()["id"]  # INV-1042 R-007: still no delivery note
    await _patch(client, auth, tid, status="IN_PROGRESS")
    r = await _patch(client, auth, tid, status="SUBMITTED_FOR_RECHECK")
    assert r.status_code == 200 and r.json()["status"] == "IN_PROGRESS"  # re-validated: FAIL


async def test_edit_and_cancel(client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth) -> None:
    tid = (await create(client, auth)).json()["id"]
    r = await _patch(client, auth, tid, step="Yeni addım mətni", comment=None)
    assert r.status_code == 200 and r.json()["step"] == "Yeni addım mətni"
    assert (await _patch(client, auth, tid, due_date="2020-01-01")).status_code == 422
    assert (await client.delete(f"/v1/tasks/{tid}", headers=auth("u1"))).status_code == 204
    assert (await _patch(client, auth, tid, step="sonra")).status_code == 404
    assert (await create(client, auth)).status_code == 201  # the rule is free again
