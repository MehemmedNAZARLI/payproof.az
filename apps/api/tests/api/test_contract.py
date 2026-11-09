"""Responses validate against packages/contracts/openapi.yaml (the single source of truth)."""

from collections.abc import Callable
from functools import cache
from pathlib import Path
from typing import Any

import httpx
import pytest
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012
from ruamel.yaml import YAML
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.seed.fixtures import PACKAGES, uid

Auth = Callable[[str], dict[str, str]]
SPEC_PATH = Path(__file__).parents[4] / "packages/contracts/openapi.yaml"


@cache
def _validator(schema: str) -> Draft202012Validator:
    spec = YAML(typ="safe").load(SPEC_PATH.read_text())  # YAML 1.2, like the contract tooling
    resource: Resource[Any] = DRAFT202012.create_resource(spec)
    registry: Registry[Any] = Registry().with_resource("openapi.yaml", resource)
    return Draft202012Validator(
        {"$ref": f"openapi.yaml#/components/schemas/{schema}"},
        registry=registry,
        format_checker=Draft202012Validator.FORMAT_CHECKER,
    )


def assert_matches(schema: str, body: Any) -> None:
    errors = sorted(_validator(schema).iter_errors(body), key=lambda e: list(e.path))
    assert not errors, "\n".join(f"{list(e.path)}: {e.message}" for e in errors[:10])


@pytest.mark.parametrize(
    ("path", "schema"),
    [
        ("/v1/me", "Me"),
        ("/v1/dashboard", "Dashboard"),
        ("/v1/packages?limit=200", "PackagePage"),
    ],
)
async def test_read_responses_match_contract(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth, path: str, schema: str
) -> None:
    r = await client.get(path, headers=auth("u2"))
    assert r.status_code == 200
    assert_matches(schema, r.json())


@pytest.mark.parametrize("pkg", sorted(p["id"] for p in PACKAGES.values()))
async def test_every_package_detail_matches_contract(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth, pkg: str
) -> None:
    r = await client.get(f"/v1/packages/{uid(pkg)}", headers=auth("u1"))
    assert r.status_code == 200
    assert_matches("PackageDetail", r.json())


def test_validator_rejects_drift() -> None:
    # guard against a validator that silently accepts everything
    with pytest.raises(AssertionError):
        assert_matches("Blocker", {"rule_id": "R-001", "outcome": "PASS"})
    with pytest.raises(AssertionError):
        assert_matches("Money", {"amount": "1.00", "currency": "AZN", "extra": 1})


async def test_errors_match_contract(client: httpx.AsyncClient) -> None:
    assert_matches("Error", (await client.get("/v1/me")).json())
