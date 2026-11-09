import json
import logging

import pytest
from fastapi.testclient import TestClient

from payproof.core.logging import CORRELATION_HEADER, JsonFormatter
from payproof.main import create_app


def _client() -> TestClient:
    app = create_app()

    def boom() -> None:
        raise RuntimeError("INV-1042 secret document text")

    app.add_api_route("/boom", boom)
    return TestClient(app, raise_server_exceptions=False)


def test_unhandled_error_is_500_with_correlation_id_and_no_leak(
    caplog: pytest.LogCaptureFixture,
) -> None:
    r = _client().get("/boom", headers={CORRELATION_HEADER: "cid-9"})
    assert r.status_code == 500
    assert r.json()["error"]["code"] == "INTERNAL_ERROR"
    assert r.headers[CORRELATION_HEADER] == "cid-9"
    assert "secret" not in r.text

    record = next(rec for rec in caplog.records if rec.exc_info)
    line = json.loads(JsonFormatter().format(record))
    assert line["correlation_id"] == "cid-9"
    assert "RuntimeError" in line["exc"]
    assert "secret" not in json.dumps(line)


def test_log_formatter_never_writes_exception_message() -> None:
    try:
        raise ValueError("document text")
    except ValueError:
        record = logging.makeLogRecord({"msg": "x", "exc_info": __import__("sys").exc_info()})
    assert "document text" not in JsonFormatter().format(record)
