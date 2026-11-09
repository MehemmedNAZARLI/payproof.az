from collections.abc import Callable

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.api.ratelimit import MAX_MULTIPART, Limiter, RateLimited
from payproof.seed.files import placeholder
from payproof.seed.fixtures import uid
from tests.integration.factories import make_tenant

Auth = Callable[[str], dict[str, str]]


def test_sliding_window(monkeypatch: pytest.MonkeyPatch) -> None:
    now = [100.0]
    monkeypatch.setattr("payproof.api.ratelimit.time.monotonic", lambda: now[0])
    limiter = Limiter()
    for _ in range(3):
        limiter.hit("upload:u1", limit=3, window=60)
    with pytest.raises(RateLimited) as blocked:
        limiter.hit("upload:u1", limit=3, window=60)
    assert blocked.value.details == {"retry_after": 60}
    assert blocked.value.headers == {"Retry-After": "60"}
    limiter.hit("upload:u2", limit=3, window=60)  # someone else is not affected
    now[0] += 61
    limiter.hit("upload:u1", limit=3, window=60)  # the window moved on


async def test_dev_login_answers_429_with_retry_after(
    client: httpx.AsyncClient, seeded: AsyncSession
) -> None:
    body = {"user_id": str(uid("u1"))}
    codes = [(await client.post("/v1/auth/dev-login", json=body)).status_code for _ in range(10)]
    assert codes == [200] * 10
    r = await client.post("/v1/auth/dev-login", json=body)
    assert r.status_code == 429 and r.json()["error"]["code"] == "RATE_LIMITED"
    assert int(r.headers["retry-after"]) > 0


async def test_oversized_multipart_is_refused_before_it_is_read(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    headers = {
        **auth("u1"),
        "Content-Type": "multipart/form-data; boundary=x",
        "Content-Length": str(MAX_MULTIPART + 1),
        "Idempotency-Key": "6f1d2c3b-4a5e-4f60-9a7b-8c9d0e1f2a3b",
    }
    r = await client.post("/v1/packages", headers=headers, content=b"--x--")
    assert r.status_code == 413 and r.json()["error"]["code"] == "FILE_TOO_LARGE"


async def test_owner_from_another_company_is_refused(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    other = await make_tenant(seeded)
    r = await client.post(
        "/v1/packages",
        headers={**auth("u1"), "Idempotency-Key": "7f1d2c3b-4a5e-4f60-9a7b-8c9d0e1f2a3b"},
        data={"customer_id": str(uid("c1")), "owner_id": str(other.user.id)},
        files={"invoice": ("INV-1052.pdf", placeholder("INV-1052.pdf"), "application/pdf")},
    )
    assert r.status_code == 422  # not a 500 from the foreign key
