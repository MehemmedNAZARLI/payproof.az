import asyncio
import datetime as dt
import json
import uuid

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.api import events as api
from payproof.core.auth import TOKEN_TTL, issue_dev_token
from payproof.core.settings import get_settings
from payproof.realtime.hub import Hub
from payproof.seed.fixtures import uid
from payproof.seed.identity import COMPANY_ID


def _token(lives: float) -> dict[str, str]:
    """u1's token that expires `lives` seconds from now (ASGITransport returns the body only
    once the stream ends — the expiry ends it)."""
    issued = dt.datetime.now(dt.UTC) - TOKEN_TTL + dt.timedelta(seconds=lives)
    token, _ = issue_dev_token(uid("u1"), get_settings().jwt_secret.get_secret_value(), issued)
    return {"Authorization": f"Bearer {token}"}


def _event(company: uuid.UUID) -> str:
    return json.dumps(
        {"event_id": str(uuid.uuid4()), "company_id": str(company), "type": "package.updated"}
    )


async def _subscribed(hub: Hub, n: int = 1) -> None:
    for _ in range(200):
        if hub.count() == n:
            return
        await asyncio.sleep(0.01)
    pytest.fail(f"{hub.count()} subscribers, expected {n}")


async def test_needs_a_token(client: httpx.AsyncClient) -> None:
    r = await client.get("/v1/events")
    assert r.status_code == 401 and r.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_streams_own_company_events_pings_and_closes_at_token_expiry(
    client: httpx.AsyncClient, app: FastAPI, seeded: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(api, "HEARTBEAT", 0.1)
    hub: Hub = app.state.hub
    request = asyncio.create_task(
        client.get("/v1/events", headers={**_token(2.0), "Last-Event-ID": "x"})
    )
    await _subscribed(hub)
    own, foreign = _event(COMPANY_ID), _event(uuid.uuid4())
    hub.dispatch(foreign)
    hub.dispatch(own)
    r = await asyncio.wait_for(request, timeout=5)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/event-stream")
    assert (r.headers["cache-control"], r.headers["x-accel-buffering"]) == ("no-cache", "no")
    body = r.text
    sent = json.loads(own)
    assert f"id: {sent['event_id']}\nevent: package.updated\ndata: {own}\n\n" in body
    assert json.loads(foreign)["event_id"] not in body  # another tenant's event never arrives
    assert ": ping\n\n" in body
    assert hub.count() == 0  # stream closed by the expiry, subscriber removed


async def test_client_leaving_removes_the_subscriber(
    client: httpx.AsyncClient, app: FastAPI, seeded: AsyncSession
) -> None:
    hub: Hub = app.state.hub
    request = asyncio.create_task(client.get("/v1/events", headers=_token(60)))
    await _subscribed(hub)
    request.cancel()
    await asyncio.gather(request, return_exceptions=True)
    await _subscribed(hub, 0)


async def test_full_queue_ends_the_stream(
    client: httpx.AsyncClient, app: FastAPI, seeded: AsyncSession
) -> None:
    hub: Hub = app.state.hub
    request = asyncio.create_task(client.get("/v1/events", headers=_token(60)))
    await _subscribed(hub)
    [sub] = [s for subs in hub._subs.values() for s in subs]
    sub.close()  # what an overflow or a lost LISTEN connection does
    r = await asyncio.wait_for(request, timeout=5)
    assert r.status_code == 200 and hub.count() == 0


async def test_stream_is_one_access_line_without_events(
    client: httpx.AsyncClient,
    app: FastAPI,
    seeded: AsyncSession,
    caplog: pytest.LogCaptureFixture,
) -> None:
    hub: Hub = app.state.hub
    caplog.set_level("INFO", logger="payproof.access")
    request = asyncio.create_task(client.get("/v1/events", headers=_token(1.5)))
    await _subscribed(hub)
    secret = _event(COMPANY_ID)
    hub.dispatch(secret)
    await asyncio.wait_for(request, timeout=5)
    lines = [r for r in caplog.records if r.name == "payproof.access" and "/v1/events" in r.message]
    assert len(lines) == 1 and "stream" in lines[0].message and "ms" in lines[0].message
    assert json.loads(secret)["event_id"] not in caplog.text
