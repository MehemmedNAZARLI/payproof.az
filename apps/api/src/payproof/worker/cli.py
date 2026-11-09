"""`uv run payproof-worker` — process jobs until SIGINT/SIGTERM; the current job finishes first."""

import asyncio
import contextlib
import logging
import signal

from payproof.core.db import get_sessionmaker
from payproof.core.logging import configure_logging
from payproof.core.settings import get_settings
from payproof.extraction.pipeline import adapter_extractor, get_adapter
from payproof.repositories import models  # noqa: F401 — registers every table and the guard
from payproof.storage.s3 import get_storage
from payproof.worker.create import create_handler
from payproof.worker.extract import extract_handler
from payproof.worker.queue import PostgresQueue
from payproof.worker.runner import Handler, run_once

log = logging.getLogger(__name__)
IDLE_POLL = 1.0  # seconds between checks when the queue is empty


def handlers() -> dict[str, Handler]:
    extract = adapter_extractor(get_adapter(), get_storage())
    return {"extract_document": extract_handler(extract), "create_package": create_handler(extract)}


async def _main() -> None:
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)
    sessions, queue, known = get_sessionmaker(), PostgresQueue(), handlers()
    log.info("worker started")
    while not stop.is_set():
        if not await run_once(sessions, queue, known):
            with contextlib.suppress(TimeoutError):  # idle: wait, but wake up on stop
                await asyncio.wait_for(stop.wait(), timeout=IDLE_POLL)
    log.info("worker stopped")


def run() -> None:
    configure_logging(get_settings().log_level)
    asyncio.run(_main())
