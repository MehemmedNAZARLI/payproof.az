import httpx
import pytest

from payproof.core.settings import get_settings
from payproof.main import create_app

PREFLIGHT = {
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "authorization,content-type,idempotency-key,last-event-id",
}


def _client(origins: str | None = None) -> httpx.AsyncClient:
    settings = get_settings()
    if origins is not None:
        settings = settings.model_copy(update={"cors_origins": origins})
    transport = httpx.ASGITransport(app=create_app(settings))
    return httpx.AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.parametrize("origin", ["http://localhost:3000", "http://localhost:3001"])
async def test_allowed_origin_preflight(origin: str) -> None:
    async with _client() as c:
        r = await c.options("/v1/packages", headers={"Origin": origin, **PREFLIGHT})
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == origin
    allowed = {h.strip().lower() for h in r.headers["access-control-allow-headers"].split(",")}
    assert {"authorization", "content-type", "idempotency-key", "last-event-id"} <= allowed
    assert "access-control-allow-credentials" not in r.headers


async def test_unknown_origin_gets_no_cors_headers() -> None:
    async with _client() as c:
        pre = await c.options(
            "/v1/packages", headers={"Origin": "https://evil.example", **PREFLIGHT}
        )
        get = await c.get("/v1/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in pre.headers
    assert "access-control-allow-origin" not in get.headers


async def test_origins_come_from_the_environment() -> None:
    async with _client("https://app.payproof.az, https://m.payproof.az") as c:
        r = await c.get("/v1/health", headers={"Origin": "https://m.payproof.az"})
        local = await c.get("/v1/health", headers={"Origin": "http://localhost:3000"})
    assert r.headers["access-control-allow-origin"] == "https://m.payproof.az"
    assert "access-control-allow-origin" not in local.headers
