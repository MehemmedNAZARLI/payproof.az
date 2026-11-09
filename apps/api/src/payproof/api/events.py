"""`GET /v1/events` — the company's live event stream (Server-Sent Events, ADR-0010)."""

import asyncio
import datetime as dt
import json
import time
import uuid
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials

from payproof.api.deps import Member, Session, bearer, require
from payproof.core.auth import token_expiry
from payproof.core.logging import access, correlation_id
from payproof.domain.permissions import Permission
from payproof.realtime.hub import Hub

router = APIRouter(tags=["events"])
HEARTBEAT = 15.0  # seconds; proxies drop idle connections, clients spot dead ones
HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
Viewer = Annotated[Member, Depends(require(Permission.VIEW))]


def get_hub(request: Request) -> Hub:
    hub: Hub = request.app.state.hub
    return hub


def _frame(data: str) -> str:
    e = json.loads(data)
    return f"id: {e['event_id']}\nevent: {e['type']}\ndata: {data}\n\n"


async def _frames(
    hub: Hub, company: uuid.UUID, expires: dt.datetime, cid: str | None
) -> AsyncIterator[str]:
    sub = hub.subscribe(company)  # here, not in the route: a stream never started cannot leak it
    started = time.perf_counter()
    try:
        while not sub.closed:
            left = (expires - dt.datetime.now(dt.UTC)).total_seconds()
            if left <= 0:
                return  # expired token: the client's next connect gets 401
            try:
                data = await asyncio.wait_for(sub.queue.get(), timeout=min(HEARTBEAT, left))
            except TimeoutError:
                yield ": ping\n\n"
                continue
            if data is None or sub.closed:
                return  # full queue or lost LISTEN: the client reconnects and refetches
            yield _frame(data)
    finally:
        hub.unsubscribe(sub)
        token = correlation_id.set(cid)
        # the stream's single access line (the middleware skips it); never the events themselves
        access.info("GET /v1/events stream %.0fms", (time.perf_counter() - started) * 1000)
        correlation_id.reset(token)


@router.get("/events")
async def stream_events(
    session: Session,
    member: Viewer,
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer)],
    hub: Annotated[Hub, Depends(get_hub)],
    last_event_id: Annotated[str | None, Header(alias="Last-Event-ID")] = None,
) -> StreamingResponse:
    del last_event_id  # accepted, not replayed in P0: on (re)connect the client refetches
    expires = token_expiry(credentials.credentials)  # already verified by `member`
    await session.close()  # give the pooled connection back: streams stay open for hours
    return StreamingResponse(
        _frames(hub, member.company_id, expires, correlation_id.get()),
        media_type="text/event-stream",
        headers=HEADERS,
    )
