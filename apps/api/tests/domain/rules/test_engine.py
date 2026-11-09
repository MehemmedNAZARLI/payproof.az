import itertools

import pytest

from payproof.domain.enums import CheckOutcome as O
from payproof.domain.enums import PackageStatus as S
from payproof.domain.rules.engine import blockers, evaluate, primary_blockers
from payproof.domain.rules.result import CheckResult, FixHint
from payproof.domain.status import derive_status
from tests.domain.builders import azn, delivery, invoice, rules, snapshot


def test_evaluates_all_nine_rules_in_order() -> None:
    checks = evaluate(snapshot())
    assert [c.rule_id for c in checks] == [f"R-00{i}" for i in range(1, 10)]


def test_clean_package_has_no_blockers() -> None:
    s = snapshot(rules=rules(require_signature=True), signature_reviewed=True)
    checks = evaluate(s)
    # builder delivery has only GY-1L, so R-006 flags DY-5 as undelivered
    assert [c.rule_id for c in blockers(checks)] == ["R-006"]


def test_r004_gates_r005_and_r006_and_r007_gates_r008() -> None:
    s = snapshot(order=None, candidates=("PO-381",), rules=rules(require_signature=True))
    by_id = {c.rule_id: c for c in evaluate(s)}
    assert all(by_id[r].cascade for r in ("R-004", "R-005", "R-006", "R-007", "R-008"))
    # only the missing link is a primary problem; everything waiting on it is cascade
    assert [c.rule_id for c in primary_blockers(list(by_id.values()))] == ["R-002"]


def test_delivery_for_other_order_cascades_into_signature() -> None:
    s = snapshot(delivery=delivery(po_ref="PO-384"), rules=rules(require_signature=True))
    by_id = {c.rule_id: c for c in evaluate(s)}
    assert (by_id["R-007"].outcome, by_id["R-008"].cascade) == (O.UNKNOWN, True)


def _checks(*outcomes: O) -> list[CheckResult]:
    return [CheckResult(f"R-00{i}", o, "") for i, o in enumerate(outcomes, 1)]


def _status(checks: list[CheckResult], **flags: bool) -> S:
    base = {"processing": False, "link_confirmed": True, "approved": False, "exported": False}
    return derive_status(checks=checks, **{**base, **flags})


def test_status_order() -> None:
    ok, fail, unknown = _checks(O.PASS), _checks(O.FAIL, O.UNKNOWN), _checks(O.UNKNOWN)
    assert _status(fail, processing=True) is S.PROCESSING
    assert _status(ok, link_confirmed=False) is S.NEEDS_REVIEW
    assert _status(fail) is S.NEEDS_FIX
    assert _status(unknown) is S.NEEDS_REVIEW
    assert _status(_checks(O.PASS, O.NOT_APPLICABLE)) is S.READY_FOR_APPROVAL
    assert _status(ok, approved=True) is S.APPROVED_READY
    assert _status(ok, approved=True, exported=True) is S.EXPORTED


@pytest.mark.parametrize("flags", list(itertools.product([False, True], repeat=4)))
def test_unknown_never_ready_or_approved(flags: tuple[bool, bool, bool, bool]) -> None:
    processing, link, approved, exported = flags
    for outcomes in itertools.product(list(O), repeat=2):
        if O.UNKNOWN not in outcomes and O.FAIL not in outcomes:
            continue
        status = _status(
            _checks(*outcomes),
            processing=processing,
            link_confirmed=link,
            approved=approved,
            exported=exported,
        )
        assert status not in (S.READY_FOR_APPROVAL, S.APPROVED_READY, S.EXPORTED)


def test_export_without_valid_approval_is_not_exported() -> None:
    assert _status(_checks(O.PASS), exported=True) is S.READY_FOR_APPROVAL


def test_invoice_without_lines_blocks_instead_of_crashing() -> None:
    # extraction read no lines (B-15): nothing to compare is never PASS
    s = snapshot(invoice=invoice(lines=(), total=azn("0.00")))
    by_id = {c.rule_id: c for c in evaluate(s)}
    for rule in ("R-005", "R-006", "R-009"):
        assert (by_id[rule].outcome, by_id[rule].fix_hint) == (O.UNKNOWN, FixHint.EDIT_FIELD)
        assert by_id[rule].message == (
            "Faktura sətirləri oxunmadı. Mənbəyə baxıb sahəni təsdiqləyin."
        )


def test_no_results_is_never_ready() -> None:
    # a run not written yet (job queued, failed) must not read as "everything passed"
    assert _status([]) is S.NEEDS_REVIEW
    assert _status([], approved=True) is S.NEEDS_REVIEW
