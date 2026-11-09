import asyncio
import json
import uuid
from collections.abc import AsyncIterator

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from payproof.realtime.hub import Hub
from payproof.services import events

A, B = uuid.uuid4(), uuid.uuid4()


def _event(company: uuid.UUID) -> str:
    return json.dumps({"event_id": str(uuid.uuid4()), "company_id": str(company)})


def test_fan_out_is_per_company() -> None:
    hub = Hub("postgresql+asyncpg://unused/db")
    a1, a2, b = hub.subscribe(A), hub.subscribe(A), hub.subscribe(B)
    hub.dispatch(_event(A))
    assert (a1.queue.qsize(), a2.queue.qsize(), b.queue.qsize()) == (1, 1, 0)
    hub.dispatch("not json")  # dropped, not raised into the LISTEN callback
    hub.unsubscribe(a1)
    hub.unsubscribe(a2)
    hub.unsubscribe(b)
    assert hub.count() == 0


def test_full_queue_closes_only_that_stream() -> None:
    hub = Hub("postgresql+asyncpg://unused/db", queue_size=2)
    slow, other = hub.subscribe(A), hub.subscribe(A)
    for _ in range(3):
        hub.dispatch(_event(A))
        other.queue.get_nowait()
    assert slow.closed and not other.closed


@pytest.fixture
async def hub(test_db_url: str) -> AsyncIterator[Hub]:
    h = Hub(test_db_url, retry=0.05)
    await h.start()
    await asyncio.wait_for(h.listening.wait(), timeout=5)
    yield h
    await h.stop()


async def _commit_event(engine: AsyncEngine, company: uuid.UUID) -> None:
    async with AsyncSession(engine) as s:
        await events.notify(s, {"company_id": str(company)})
        await s.commit()


async def test_committed_event_reaches_the_stream_within_2s(
    hub: Hub, db_engine: AsyncEngine
) -> None:
    sub = hub.subscribe(A)
    await _commit_event(db_engine, A)
    data = await asyncio.wait_for(sub.queue.get(), timeout=2)
    assert data is not None and json.loads(data)["company_id"] == str(A)


async def test_reconnects_and_closes_streams_after_a_lost_connection(
    hub: Hub, db_engine: AsyncEngine
) -> None:
    sub = hub.subscribe(A)
    async with db_engine.connect() as c:
        await c.execute(
            text(
                "select pg_terminate_backend(pid) from pg_stat_activity "
                "where query like 'LISTEN%' and pid <> pg_backend_pid()"
            )
        )
    assert await asyncio.wait_for(sub.queue.get(), timeout=5) is None and sub.closed
    hub.unsubscribe(sub)
    await asyncio.wait_for(hub.listening.wait(), timeout=5)
    fresh = hub.subscribe(A)
    for _ in range(20):  # LISTEN re-issued right after `listening` is set; retry the commit
        await _commit_event(db_engine, A)
        try:
            await asyncio.wait_for(fresh.queue.get(), timeout=0.2)
            break
        except TimeoutError:
            continue
    else:
        pytest.fail("no event after reconnect")
