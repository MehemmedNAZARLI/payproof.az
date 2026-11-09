import asyncio
import json
import uuid
from typing import Any

import asyncpg
import pytest
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from payproof.repositories.base import bind_tenant
from payproof.repositories.models import AuditEvent
from payproof.services import events
from payproof.services.audit import record
from tests.api.test_contract import assert_matches
from tests.integration.factories import Tenant, add, package


@pytest.mark.parametrize(
    ("action", "expected"),
    [
        ("package.created", "package.created"),
        ("approval.created", "package.approved"),
        ("export.created", "package.exported"),
        ("package.deleted", "package.deleted"),
        ("requirements.updated", "requirements.changed"),
        ("task.resolved", "task.changed"),
        ("document.uploaded", "package.updated"),
        ("approval.invalidated", "package.updated"),
    ],
)
def test_event_type_follows_the_mock_mapping(action: str, expected: str) -> None:
    assert events.event_type(action) == expected


async def test_record_publishes_ids_only(
    db: AsyncSession, a: Tenant, monkeypatch: pytest.MonkeyPatch
) -> None:
    sent: list[dict[str, Any]] = []

    async def capture(_: AsyncSession, event: AuditEvent) -> None:
        sent.append(events.live_event(event))

    monkeypatch.setattr(events, "publish", capture)
    pkg = package(a, version=4)
    await add(db, pkg)
    bind_tenant(db, a.company.id)
    e = await record(db, actor_id=a.user.id, action="approval.created", message="v4", package=pkg)
    [payload] = sent
    assert_matches("LiveEvent", payload)  # additionalProperties: false — no names or amounts
    assert payload == {
        "event_id": str(e.id),
        "company_id": str(a.company.id),
        "type": "package.approved",
        "package_id": str(pkg.id),
        "package_version": 4,
        "actor_id": str(a.user.id),
        "at": e.created_at.isoformat().replace("+00:00", "Z"),
    }


async def _listen(url: str) -> tuple[asyncpg.Connection, asyncio.Queue[str]]:
    conn = await asyncpg.connect(make_url(url).set(drivername="postgresql").render_as_string(False))
    got: asyncio.Queue[str] = asyncio.Queue()
    await conn.add_listener(events.CHANNEL, lambda *args: got.put_nowait(args[-1]))
    return conn, got


@pytest.mark.parametrize("commit", [True, False])
async def test_delivered_only_after_commit(
    db_engine: AsyncEngine, test_db_url: str, commit: bool
) -> None:
    conn, got = await _listen(test_db_url)
    try:
        event_id = str(uuid.uuid4())
        async with AsyncSession(db_engine) as s:  # a real transaction, not the test's savepoint
            await events.notify(s, {"event_id": event_id, "type": "package.created"})
            await asyncio.sleep(0.2)
            assert got.empty()  # nothing before COMMIT
            await (s.commit() if commit else s.rollback())
        if commit:
            body = json.loads(await asyncio.wait_for(got.get(), timeout=2))
            assert body["event_id"] == event_id
        else:
            with pytest.raises(TimeoutError):
                await asyncio.wait_for(got.get(), timeout=0.5)
    finally:
        await conn.close()
