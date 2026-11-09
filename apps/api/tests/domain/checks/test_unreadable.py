"""Invariant: data that could not be read is UNKNOWN — never FAIL, never NOT_APPLICABLE."""

import copy
import json
from typing import Any

import pytest

from payproof.domain.checks.engine import EvalContext, evaluate
from payproof.seed.fixtures import FIXTURES

SCENARIO = json.loads((FIXTURES / "scenarios" / "unec.json").read_text())
RS = SCENARIO["customer"]["requirement_sets"][0]
NAMES = {
    t["key"]: t["name"] for t in json.loads((FIXTURES / "config/document-types.json").read_text())
}


def _cases() -> list[tuple[str, str, str]]:
    out = []
    for p in SCENARIO["packages"]:
        for d in p["documents"]:
            out += [(p["reference"], d["id"], k) for k in [*d["fields"], *d["tables"]]]
    return out


def _outcomes(packages: list[Any], ref: str) -> dict[str, str]:
    p = next(x for x in packages if x["reference"] == ref)
    results = evaluate(p, RS, EvalContext(others=packages, names=NAMES))
    return {r["rule_id"]: r["outcome"] for r in results}


@pytest.mark.parametrize(("ref", "doc", "key"), _cases(), ids=lambda x: str(x))
def test_marking_a_value_unreadable_never_fails_or_skips_a_check(
    ref: str, doc: str, key: str
) -> None:
    before = _outcomes(SCENARIO["packages"], ref)
    packages = copy.deepcopy(SCENARIO["packages"])
    d = next(x for p in packages for x in p["documents"] if x["id"] == doc)
    if key in d["fields"]:
        d["fields"][key] = None
    d["unreadable"].append(key)
    after = _outcomes(packages, ref)
    for rule_id, outcome in after.items():
        if outcome != before[rule_id]:
            assert outcome == "UNKNOWN", (rule_id, before[rule_id], outcome)
