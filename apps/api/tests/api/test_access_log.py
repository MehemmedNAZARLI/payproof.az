import json
import logging

import httpx
import pytest

from payproof.core.logging import CORRELATION_HEADER, JsonFormatter


async def test_access_log_has_path_status_and_correlation_but_no_query(
    client: httpx.AsyncClient, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.INFO, logger="payproof.access"):
        await client.get(
            "/v1/health?q=secret-search-term&token=abc", headers={CORRELATION_HEADER: "cid-77"}
        )
    records = [r for r in caplog.records if r.name == "payproof.access"]
    assert len(records) == 1
    line = json.loads(JsonFormatter().format(records[0]))
    assert line["correlation_id"] == "cid-77"
    assert line["message"].startswith("GET /v1/health 200 ")
    assert "secret" not in json.dumps(line) and "token" not in json.dumps(line)
