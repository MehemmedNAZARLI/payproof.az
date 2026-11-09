import json
import logging

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from payproof.core.logging import (
    CORRELATION_HEADER,
    JsonFormatter,
    configure_logging,
    correlation_id_middleware,
)


def _app() -> FastAPI:
    configure_logging()
    app = FastAPI()
    app.middleware("http")(correlation_id_middleware)

    @app.get("/ping")
    def ping() -> dict[str, str]:
        logging.getLogger("payproof.test").info("pong")
        return {"ok": "yes"}

    return app


def test_generates_correlation_id() -> None:
    r = TestClient(_app()).get("/ping")
    assert len(r.headers[CORRELATION_HEADER]) == 32


def test_echoes_incoming_correlation_id() -> None:
    r = TestClient(_app()).get("/ping", headers={CORRELATION_HEADER: "abc-123"})
    assert r.headers[CORRELATION_HEADER] == "abc-123"


def test_rejects_unsafe_incoming_id() -> None:
    r = TestClient(_app()).get("/ping", headers={CORRELATION_HEADER: "x" * 200})
    assert r.headers[CORRELATION_HEADER] != "x" * 200


def test_log_line_is_json_with_correlation_id(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.INFO, logger="payproof.test"):
        TestClient(_app()).get("/ping", headers={CORRELATION_HEADER: "cid-1"})
    record = next(r for r in caplog.records if r.name == "payproof.test")
    line = json.loads(JsonFormatter().format(record))
    assert line["message"] == "pong"
    assert line["level"] == "INFO"
    assert line["correlation_id"] == "cid-1"
