"""Simple sliding-window rate limit for uploads (per user) and dev-login (per address).
shortcut: counts live in this process's memory, so N workers allow N× the limit and a restart
forgets them — move the counters to Postgres or Redis when the API runs on more than one process."""

import math
import time
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable
from typing import ClassVar

from fastapi import Request, Response

from payproof.api.deps import CurrentMember
from payproof.core.errors import DomainError, ErrorCode, FileTooLarge, error_response
from payproof.services.files import MAX_BYTES, MAX_MB


class RateLimited(DomainError):
    status_code = 429
    code = ErrorCode.RATE_LIMITED
    message = "Çox sorğu göndərildi — bir az sonra yenidən cəhd edin."
    headers: ClassVar[dict[str, str]] = {}

    def __init__(self, retry_after: int) -> None:
        super().__init__(details={"retry_after": retry_after})
        self.headers = {"Retry-After": str(retry_after)}  # type: ignore[misc]


class Limiter:
    def __init__(self) -> None:
        self._hits: defaultdict[str, deque[float]] = defaultdict(deque)

    def hit(self, key: str, limit: int, window: float) -> None:
        now = time.monotonic()
        hits = self._hits[key]
        while hits and hits[0] <= now - window:
            hits.popleft()
        if len(hits) >= limit:
            raise RateLimited(max(1, math.ceil(hits[0] + window - now)))
        hits.append(now)


def _limiter(request: Request) -> Limiter:
    state = request.app.state
    if not hasattr(state, "limiter"):
        state.limiter = Limiter()  # one per app: tests get a fresh one each
    limiter: Limiter = state.limiter
    return limiter


def per_user(bucket: str, limit: int, window: float = 60) -> Callable[..., Awaitable[None]]:
    async def check(request: Request, member: CurrentMember) -> None:
        _limiter(request).hit(f"{bucket}:{member.user_id}", limit, window)

    return check


def per_address(bucket: str, limit: int, window: float = 60) -> Callable[..., Awaitable[None]]:
    async def check(request: Request) -> None:
        address = request.client.host if request.client else "unknown"
        _limiter(request).hit(f"{bucket}:{address}", limit, window)

    return check


MAX_MULTIPART = 3 * (MAX_BYTES + 1024 * 1024)  # invoice, order, delivery + the form fields
UPLOADS = per_user("upload", 30)  # documents, new versions, new packages


async def body_limit_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """413 before a multipart body is read: FastAPI spools the whole form to disk before any
    route dependency runs, so the per-file cap alone would not stop a huge request.
    shortcut: needs Content-Length — a chunked upload is left to the proxy's body limit."""
    size = request.headers.get("content-length", "")
    multipart = request.headers.get("content-type", "").startswith("multipart/")
    if multipart and size.isdigit() and int(size) > MAX_MULTIPART:
        err = FileTooLarge(details={"max_mb": MAX_MB})
        return error_response(err.status_code, err.code, err.message, err.details)
    return await call_next(request)


LOGINS = per_address("login", 10)
