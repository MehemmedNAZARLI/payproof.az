from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from payproof.core.errors import DomainError, ErrorCode, NotFound, register_error_handlers


class VersionConflict(DomainError):
    status_code = 409
    code = ErrorCode.VERSION_CONFLICT
    message = "Paket yenilənib; səhifəni yeniləyin."


class Body(BaseModel):
    qty: int


def _client() -> TestClient:
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/missing")
    def missing() -> None:
        raise NotFound

    @app.get("/conflict")
    def conflict() -> None:
        raise VersionConflict(details={"current_version": 3})

    @app.post("/body")
    def body(b: Body) -> Body:
        return b

    return TestClient(app, raise_server_exceptions=False)


def test_domain_error_uses_standard_format() -> None:
    r = _client().get("/missing")
    assert r.status_code == 404
    assert r.json() == {"error": {"code": "NOT_FOUND", "message": "Tapılmadı.", "details": {}}}


def test_domain_error_carries_details() -> None:
    r = _client().get("/conflict")
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "VERSION_CONFLICT"
    assert r.json()["error"]["details"] == {"current_version": 3}


def test_malformed_body_is_400_validation_error_without_input_echo() -> None:
    r = _client().post("/body", json={"qty": "INV-1042 private text"})
    assert r.status_code == 400
    err = r.json()["error"]
    assert err["code"] == "VALIDATION_ERROR"
    assert err["details"]["fields"][0]["loc"] == ["body", "qty"]
    assert "private text" not in r.text


def test_framework_headers_are_kept() -> None:
    r = _client().get("/body")
    assert r.status_code == 405
    assert r.headers["allow"] == "POST"


def test_unknown_route_is_not_found() -> None:
    r = _client().get("/nope")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


def test_error_codes_match_contract() -> None:
    import pathlib
    import re

    spec = pathlib.Path(__file__).parents[4] / "packages/contracts/openapi.yaml"
    block = spec.read_text().split("    ErrorCode:")[1].split("    Error:")[0]
    assert set(re.findall(r"- ([A-Z_]+)", block)) == {c.value for c in ErrorCode}
