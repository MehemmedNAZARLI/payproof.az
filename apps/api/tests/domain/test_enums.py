import ast
import pathlib
import re
import sys
from enum import StrEnum

import pytest

from payproof.domain.enums import (
    CheckOutcome,
    Currency,
    DocumentStatus,
    PackageStatus,
    Role,
    TaskStatus,
)

ROOT = pathlib.Path(__file__).parents[2]
SPEC = (ROOT.parents[1] / "packages/contracts/openapi.yaml").read_text()


def contract_enum(name: str) -> list[str]:
    """`components.schemas.<name>.enum` from openapi.yaml (inline or multi-line list)."""
    match = re.search(rf"\n    {name}:\n      type: string\n      enum:\s*\[([^\]]+)\]", SPEC)
    assert match, name
    return [v.strip() for v in match.group(1).split(",") if v.strip()]


@pytest.mark.parametrize(
    ("enum", "schema"),
    [
        (PackageStatus, "PackageStatus"),
        (CheckOutcome, "CheckOutcome"),
        (TaskStatus, "TaskStatus"),
        (DocumentStatus, "DocumentVersionStatus"),
        (Role, "Role"),
        (Currency, "Currency"),
    ],
)
def test_enum_matches_contract(enum: type[StrEnum], schema: str) -> None:
    assert [e.value for e in enum] == contract_enum(schema)


def test_no_paid_status() -> None:
    assert "PAID" not in PackageStatus.__members__


def test_domain_imports_only_stdlib() -> None:
    """domain/ is pure (apps/api/CLAUDE.md): no I/O, frameworks or other payproof layers."""
    for path in (ROOT / "src/payproof/domain").rglob("*.py"):
        for node in ast.walk(ast.parse(path.read_text())):
            names = (
                [a.name for a in node.names] if isinstance(node, ast.Import) else
                [node.module or ""] if isinstance(node, ast.ImportFrom) and node.level == 0 else []
            )  # fmt: skip
            for name in names:
                top = name.split(".")[0]
                ok = top in sys.stdlib_module_names or name.startswith("payproof.domain")
                assert ok, f"{path.name} imports {name}"
