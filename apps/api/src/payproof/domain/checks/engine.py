"""Configured check evaluation (ADR-0011) — port of packages/mocks/src/checks/index.ts.

Pure and deterministic: the same package and requirement set give the same results, byte for
byte the reference's (golden: fixtures/scenarios/unec.reference.json). AI output never enters —
only stored, source-cited extracted values do."""

from collections.abc import Callable
from dataclasses import dataclass, field

from payproof.domain.checks.families_basic import document_count, field_present, values_equal
from payproof.domain.checks.families_match import transaction_match
from payproof.domain.checks.families_parties import (
    line_items_match,
    no_duplicate_use,
    party_identity_match,
)
from payproof.domain.checks.families_sums import amount_within_limit, date_within_period, totals_sum
from payproof.domain.checks.values import Json

ENGINE_VERSION = "checks-1"


@dataclass(frozen=True)
class EvalContext:
    others: list[Json] = field(default_factory=list)  # the customer's other packages
    names: dict[str, str] = field(default_factory=dict)  # registry key → display name


Family = Callable[[Json, Json, EvalContext], Json]
FAMILIES: dict[str, Family] = {
    "field_present": lambda p, a, c: field_present(p, a),
    "values_equal": lambda p, a, c: values_equal(p, a, c.names),
    "totals_sum": lambda p, a, c: totals_sum(p, a),
    "date_within_period": lambda p, a, c: date_within_period(p, a),
    "amount_within_limit": lambda p, a, c: amount_within_limit(p, a),
    "line_items_match": lambda p, a, c: line_items_match(p, a),
    "transaction_match": lambda p, a, c: transaction_match(p, a),
    "no_duplicate_use": lambda p, a, c: no_duplicate_use(p, a, c.others),
    "party_identity_match": lambda p, a, c: party_identity_match(p, a),
}


def _result(rule_id: str, check_type: str, title: str, v: Json) -> Json:
    return {"rule_id": rule_id, "check_type": check_type, "title": title,
            "outcome": v["outcome"], "cascade": False, "message": v["message"],
            "evidence": v["evidence"], "fix_hint": None, "data": v.get("data", {})}  # fmt: skip


def evaluate(p: Json, rs: Json, ctx: EvalContext) -> list[Json]:
    """D-001 (derived from `documents`) first, then every configured check in its order."""
    results = [_result("D-001", "document_count", "Sənəd dəsti tamdır",
                       document_count(p, rs, ctx.names))]  # fmt: skip
    for c in rs["checks"]:
        family = FAMILIES.get(c["type"])
        if family is None:
            raise ValueError(f"{c['id']}: unknown check type {c['type']}")
        results.append(_result(c["id"], c["type"], c["title"], family(p, c["parameters"], ctx)))
    return results


def generic_status(results: list[Json]) -> str:
    """rules-engine.md R-010 without the order link: FAIL → NEEDS_FIX, UNKNOWN → NEEDS_REVIEW."""
    if any(r["outcome"] == "FAIL" for r in results):
        return "NEEDS_FIX"
    if any(r["outcome"] == "UNKNOWN" for r in results):
        return "NEEDS_REVIEW"
    return "READY_FOR_APPROVAL"


def primary_blockers(results: list[Json]) -> list[str]:
    return [r["rule_id"] for r in results
            if not r["cascade"] and r["outcome"] in ("FAIL", "UNKNOWN")]  # fmt: skip
