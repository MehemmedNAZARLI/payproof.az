"""Golden: new demo sets and the INV-1042 demo flow, step by step, as in expected.json.
Version numbers come from expected.json: bumping them is a service concern (B-13+)."""

import copy
from collections.abc import Callable
from decimal import Decimal

import pytest

from payproof.domain.enums import CheckOutcome, PackageStatus, Role
from payproof.domain.permissions import Permission, can
from payproof.seed.fixtures import (
    EXPECTED,
    PACKAGES,
    Fixture,
    blocker_list,
    load,
    outcome_of,
    rule_set,
)

SAMPLES = {s["id"]: s for s in load("samples.json")}
NEWSETS = {n["invoice_number"]: n for n in load("newsets.json")}


def _from_newset(n: Fixture) -> Fixture:
    """A created package after extraction: exact PO of the same customer links automatically."""
    total = sum(Decimal(str(li["qty"])) * Decimal(li["unit_price"]) for li in n["lines"])
    d = n["delivery"]
    return {
        "customer_id": n["customer_id"], "currency": n["currency"], "version": 1,
        "processing": False, "signature_reviewed": False, "approvals": [], "exports": [],
        "candidates": [],
        "invoice": {"po_ref": n["po_number"], "po_raw": None, "unreadable_fields": [],
                    "total": f"{total:.2f}", "lines": n["lines"]},
        "order_link": {"po_number": n["po_number"], "confirmed": True},
        "delivery": d and {**d, "customer_id": n["customer_id"], "signed": True,
                           "lines": [{"product_code": li["product_code"], "qty": li["qty"]}
                                     for li in n["lines"]]},
    }  # fmt: skip


@pytest.mark.parametrize("number", sorted(EXPECTED["newsets"]))
def test_new_set_matches_expected(number: str) -> None:
    status, checks = outcome_of(_from_newset(NEWSETS[number]))
    expected = EXPECTED["newsets"][number]
    assert (status.value, blocker_list(checks)) == (expected["status"], expected["blockers"])


def _upload_invoice(p: Fixture, sample: str) -> None:
    p["invoice"].update(SAMPLES[sample]["extraction"], unreadable_fields=[], po_raw=None)


def _upload_delivery(p: Fixture, sample: str) -> None:
    lines = [{"product_code": li["product_code"], "qty": li["qty"]} for li in p["invoice"]["lines"]]
    dl = SAMPLES[sample]["extraction"]["delivery"]
    p["delivery"] = {**dl, "customer_id": p["customer_id"], "lines": lines}
    p["signature_reviewed"] = False


def _approve(p: Fixture) -> None:
    rs = rule_set(p)["version"]
    if not any(a["valid"] and a["package_version"] == p["version"] for a in p["approvals"]):
        p["approvals"].append(
            {"valid": True, "package_version": p["version"], "requirement_set_version": rs}
        )


def _export(p: Fixture) -> None:
    if not any(e["package_version"] == p["version"] for e in p["exports"]):
        p["exports"].append(
            {"package_version": p["version"], "requirement_set_version": rule_set(p)["version"]}
        )


STEPS: dict[str, Callable[[Fixture, Fixture], None]] = {
    "initial": lambda p, s: None,
    "approve_blocked": lambda p, s: None,  # not READY_FOR_APPROVAL -> rejected
    "confirm_link": lambda p, s: p["order_link"].update(po_number=s["po_number"], confirmed=True),
    "create_tasks": lambda p, s: None,
    "upload_invoice": lambda p, s: _upload_invoice(p, s["sample_id"]),
    "upload_duplicate": lambda p, s: None,  # same sha256 -> no new version (B-13)
    "upload_delivery": lambda p, s: _upload_delivery(p, s["sample_id"]),
    "review_signature": lambda p, s: p.update(signature_reviewed=True),
    "approve_as_operator": lambda p, s: None,
    "approve": lambda p, s: _approve(p),
    "approve_repeat": lambda p, s: _approve(p),  # idempotent: still one approval
    "export": lambda p, s: _export(p),
    "export_repeat": lambda p, s: _export(p),
}  # fmt: skip


def test_inv_1042_flow() -> None:
    p = copy.deepcopy(PACKAGES["INV-1042"])
    for step in EXPECTED["flows"]["INV-1042"]:
        p["version"] = step["version"]
        STEPS[step["step"]](p, step)
        status, checks = outcome_of(p)
        by_id = {c.rule_id: c.outcome.value for c in checks}
        name = step["step"]
        assert status.value == step["status"], name
        assert blocker_list(checks) == step["blockers"], name
        assert {r: by_id[r] for r in step.get("checks", {})} == step.get("checks", {}), name
        if name == "approve_blocked":
            assert status is not PackageStatus.READY_FOR_APPROVAL
        if name == "approve_as_operator":
            assert not can(Role.OPERATOR, Permission.APPROVE_PACKAGE)
        if "approvals" in step:
            assert len(p["approvals"]) == step["approvals"]
        if "exports" in step:
            assert len(p["exports"]) == step["exports"]
        for task in step.get("tasks", []):
            # B-17 closes a task when its rule passes; here: resolved <=> rule no longer blocks
            passed = CheckOutcome(by_id[task["rule_id"]]) is CheckOutcome.PASS
            assert passed is (task["status"] == "RESOLVED"), (name, task["number"])
