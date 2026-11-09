"""Golden: the Python check library produces fixtures/scenarios/unec.reference.json byte for byte —
the output of the TS reference (packages/mocks/src/checks) for every mutated UNEC case."""

import copy
import json
from typing import Any

import pytest

from payproof.domain.checks.engine import EvalContext, evaluate, generic_status, primary_blockers
from payproof.domain.checks.template import fill_template
from payproof.seed.fixtures import FIXTURES

SCENARIOS = FIXTURES / "scenarios"
SCENARIO = json.loads((SCENARIOS / "unec.json").read_text())
MUTATIONS = json.loads((SCENARIOS / "unec.mutations.json").read_text())
REFERENCE_TEXT = (SCENARIOS / "unec.reference.json").read_text()
REFERENCE = json.loads(REFERENCE_TEXT)
NAMES = {
    t["key"]: t["name"]
    for t in json.loads((FIXTURES / "config" / "document-types.json").read_text())
}


def _apply(p: dict[str, Any], rs: dict[str, Any], op: dict[str, Any]) -> None:
    doc = next((d for d in p["documents"] if d["id"] == op.get("doc")), None)
    match op["op"]:
        case "set":
            top, _, part = op["path"].partition(".")
            if part:
                doc["fields"][top][part] = op["value"]  # type: ignore[index]
            else:
                doc["fields"][top] = op["value"]  # type: ignore[index]
        case "unreadable":
            doc["fields"][op["field"]] = None  # type: ignore[index]
            doc["unreadable"].append(op["field"])  # type: ignore[index]
        case "drop_evidence":
            del doc["evidence"][op["key"]]  # type: ignore[index]
        case "row":
            doc["tables"][op["table"]][op["index"]][op["column"]] = op["value"]  # type: ignore[index]
        case "append_row":
            rows = doc["tables"][op["table"]]  # type: ignore[index]
            ev = doc["evidence"]  # type: ignore[index]
            ev[f"{op['table']}[{len(rows)}]"] = ev[f"{op['table']}[{op['from']}]"]
            rows.append(dict(rows[op["from"]]))
        case "clear_table":
            doc["tables"][op["table"]] = []  # type: ignore[index]
        case "unreadable_table":
            doc["unreadable"].append(op["table"])  # type: ignore[index]
        case "remove":
            p["documents"] = [d for d in p["documents"] if d["id"] != op["doc"]]
        case "copy":
            p["documents"].append({**copy.deepcopy(doc or {}), "id": op["as"]})
        case "add":
            p["documents"].append(copy.deepcopy(op["document"]))
        case "param":
            next(c for c in rs["checks"] if c["id"] == op["check"])["parameters"][op["name"]] = op[
                "value"
            ]
        case "add_check":
            rs["checks"].append(copy.deepcopy(op["check"]))
        case _:
            raise AssertionError(f"unknown op {op['op']}")


def _case(case: dict[str, Any]) -> dict[str, Any]:
    packages = copy.deepcopy(SCENARIO["packages"])
    rs = copy.deepcopy(SCENARIO["customer"]["requirement_sets"][0])
    p = next(x for x in packages if x["reference"] == case["package"])
    for op in case["ops"]:
        _apply(p, rs, op)
    results = evaluate(p, rs, EvalContext(others=packages, names=NAMES))
    approval = case["approval"] if "approval" in case else MUTATIONS["approval"]
    return {
        "status": generic_status(results),
        "primary_blockers": primary_blockers(results),
        "results": results,
        "template": fill_template(p, rs, approval),
    }


@pytest.mark.parametrize("case", MUTATIONS["cases"], ids=lambda c: c["name"])
def test_case_matches_the_reference(case: dict[str, Any]) -> None:
    got = json.dumps(_case(case), ensure_ascii=False, indent=2)
    want = json.dumps(REFERENCE[case["name"]], ensure_ascii=False, indent=2)
    assert got == want


def test_whole_file_is_byte_identical() -> None:
    out = {c["name"]: _case(c) for c in MUTATIONS["cases"]}
    assert json.dumps(out, ensure_ascii=False, indent=2) + "\n" == REFERENCE_TEXT


def test_unec_expected_outcomes() -> None:
    expected = json.loads((SCENARIOS / "unec.expected.json").read_text())["packages"]
    for ref, want in expected.items():
        case = {"package": ref, "ops": []}
        got = _case(case)
        assert {r["rule_id"]: r["outcome"] for r in got["results"]} == want["results"]
        assert (got["status"], got["primary_blockers"]) == (
            want["status"],
            want["primary_blockers"],
        )
