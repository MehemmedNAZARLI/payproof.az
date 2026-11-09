"""One LISTEN connection per API process (ADR-0010), fanned out to that company's streams."""

import asyncio
import contextlib
import json
import logging
import uuid
from collections import defaultdict

import asyncpg
from sqlalchemy.engine import make_url

from payproof.services.events import CHANNEL

log = logging.getLogger(__name__)
QUEUE_SIZE = 100


class Subscriber:
    """One open stream. A full queue closes it: the client reconnects and refetches everything."""

    def __init__(self, company_id: uuid.UUID, size: int) -> None:
        self.company_id = company_id
        self.queue: asyncio.Queue[str | None] = asyncio.Queue(size)
        self.closed = False

    def push(self, data: str) -> None:
        try:
            self.queue.put_nowait(data)
        except asyncio.QueueFull:
            self.closed = True  # the stream sees it with the next queued item

    def close(self) -> None:
        self.closed = True
        with contextlib.suppress(asyncio.QueueFull):
            self.queue.put_nowait(None)  # wake a waiting stream


class Hub:
    def __init__(self, database_url: str, *, queue_size: int = QUEUE_SIZE, retry: float = 1.0):
        self._dsn = make_url(database_url).set(drivername="postgresql").render_as_string(False)
        self._queue_size = queue_size
        self._retry = retry
        self._subs: defaultdict[uuid.UUID, set[Subscriber]] = defaultdict(set)
        self._task: asyncio.Task[None] | None = None
        self.listening = asyncio.Event()

    def subscribe(self, company_id: uuid.UUID) -> Subscriber:
        sub = Subscriber(company_id, self._queue_size)
        self._subs[company_id].add(sub)
        return sub

    def unsubscribe(self, sub: Subscriber) -> None:
        subs = self._subs.get(sub.company_id, set())
        subs.discard(sub)
        if not subs:
            self._subs.pop(sub.company_id, None)

    def count(self) -> int:
        return sum(len(s) for s in self._subs.values())

    def dispatch(self, data: str) -> None:
        """The tenant comes from the event itself; other companies' queues never see it."""
        try:
            company = uuid.UUID(json.loads(data)["company_id"])
        except (ValueError, KeyError, TypeError):
            log.warning("live event without a company dropped")
            return
        for sub in list(self._subs.get(company, ())):
            sub.push(data)

    def _drop_all(self) -> None:
        # events sent while LISTEN was down are lost: make every client reconnect and refetch
        for subs in list(self._subs.values()):
            for sub in list(subs):
                sub.close()

    async def start(self) -> None:
        self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
        self._drop_all()

    async def _run(self) -> None:
        while True:
            try:
                await self._listen()
                log.warning("live events: connection lost, reconnecting")
            except (OSError, asyncpg.PostgresError, asyncpg.InterfaceError) as exc:
                log.warning("live events: listen failed (%s)", type(exc).__name__)
            finally:
                self.listening.clear()
            self._drop_all()
            await asyncio.sleep(self._retry)

    async def _listen(self) -> None:
        """Returns when the connection is lost."""
        conn = await asyncpg.connect(self._dsn)
        try:
            lost = asyncio.Event()
            conn.add_termination_listener(lambda _: lost.set())
            await conn.add_listener(CHANNEL, lambda *args: self.dispatch(args[-1]))
            self.listening.set()
            log.info("live events: listening")
            await lost.wait()
        finally:
            if not conn.is_closed():
                await conn.close()
