from fastapi.testclient import TestClient

from payproof.core.logging import CORRELATION_HEADER
from payproof.main import create_app


def test_health_ok() -> None:
    r = TestClient(create_app()).get("/v1/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
    assert r.headers[CORRELATION_HEADER]


def test_app_uses_standard_error_format() -> None:
    r = TestClient(create_app()).get("/v1/nope")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"
