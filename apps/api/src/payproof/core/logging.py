import json
import logging
import re
import time
import traceback
import uuid
from collections.abc import Awaitable, Callable
from contextvars import ContextVar
from datetime import UTC, datetime

from fastapi import Request, Response

from payproof.core.errors import ErrorCode, error_response

CORRELATION_HEADER = "X-Correlation-ID"
_SAFE_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
correlation_id: ContextVar[str | None] = ContextVar("correlation_id", default=None)
log = logging.getLogger(__name__)
access = logging.getLogger("payproof.access")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        line = {
            "ts": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "correlation_id": getattr(record, "correlation_id", None),
        }
        if record.exc_info and record.exc_info[0]:
            etype, _, tb = record.exc_info
            # type + frame locations only: messages and source lines may carry document text
            frames = [f"{f.filename}:{f.lineno} in {f.name}" for f in traceback.extract_tb(tb)]
            line["exc"] = "\n".join([etype.__name__, *frames])
        return json.dumps(line, ensure_ascii=False)


def _install_record_factory() -> None:
    base = logging.getLogRecordFactory()
    if getattr(base, "_payproof", False):
        return

    def factory(*args: object, **kwargs: object) -> logging.LogRecord:
        record = base(*args, **kwargs)
        record.correlation_id = correlation_id.get()
        return record

    factory._payproof = True  # type: ignore[attr-defined]
    logging.setLogRecordFactory(factory)


def configure_logging(level: str = "INFO") -> None:
    _install_record_factory()
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    # replace only our own handler so repeated calls (app factory, tests) keep foreign ones
    root.handlers = [h for h in root.handlers if not isinstance(h.formatter, JsonFormatter)]
    root.addHandler(handler)
    root.setLevel(level)


async def correlation_id_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    incoming = request.headers.get(CORRELATION_HEADER, "")
    cid = incoming if _SAFE_ID.match(incoming) else uuid.uuid4().hex
    token = correlation_id.set(cid)
    started = time.perf_counter()
    response: Response | None = None
    try:
        response = await call_next(request)
    except Exception:
        # handled here, not in an app exception handler, so the correlation id is still set
        log.exception("unhandled error")
        response = error_response(500, ErrorCode.INTERNAL_ERROR, "Gözlənilməz xəta baş verdi.")
    finally:
        # our access log replaces uvicorn's: path only, the query string may hold search
        # terms or document text; logged while the correlation id is still set
        ms = (time.perf_counter() - started) * 1000
        status = response.status_code if response is not None else 500  # cancelled request
        kind = response.headers.get("content-type", "") if response is not None else ""
        stream = kind.startswith("text/event-stream")
        if not stream:  # an SSE stream logs its own line when it closes (api/events.py)
            access.info("%s %s %d %.0fms", request.method, request.url.path, status, ms)
        correlation_id.reset(token)
    response.headers[CORRELATION_HEADER] = cid
    return response
