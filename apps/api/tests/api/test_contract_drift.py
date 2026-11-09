"""The served API and packages/contracts/openapi.yaml describe the same operations (CI)."""

import re
from pathlib import Path
from typing import Any

from ruamel.yaml import YAML

from payproof.core.settings import get_settings
from payproof.main import create_app

CONTRACT = Path(__file__).parents[4] / "packages" / "contracts" / "openapi.yaml"
METHODS = {"get", "post", "patch", "put", "delete"}


def _operations(paths: dict[str, Any]) -> set[tuple[str, str]]:
    """(method, path) with parameter names blanked: `{package_id}` and `{id}` are one path."""
    return {
        (m, re.sub(r"\{[^}]+\}", "{}", p)) for p, ops in paths.items() for m in ops if m in METHODS
    }


def test_served_operations_match_the_contract() -> None:
    contract = YAML(typ="safe").load(CONTRACT.read_text())
    app = create_app(get_settings().model_copy(update={"env": "dev"}))  # dev-only routes too
    served = _operations(app.openapi()["paths"])
    expected = _operations(contract["paths"])
    assert served - expected == set(), "served but not in the contract"
    assert expected - served == set(), "in the contract but not served"


def test_status_codes_of_every_served_operation_are_documented() -> None:
    contract = YAML(typ="safe").load(CONTRACT.read_text())
    documented = {
        (m, re.sub(r"\{[^}]+\}", "{}", p)): set(op.get("responses", {}))
        for p, ops in contract["paths"].items()
        for m, op in ops.items()
        if m in METHODS
    }
    app = create_app(get_settings().model_copy(update={"env": "dev"}))
    for p, ops in app.openapi()["paths"].items():
        for m, op in ops.items():
            key = (m, re.sub(r"\{[^}]+\}", "{}", p))
            success = {c for c in op["responses"] if c.startswith("2")}
            assert success <= documented[key], (key, success, documented[key])
