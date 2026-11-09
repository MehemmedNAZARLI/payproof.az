import dataclasses
import re

import pytest

from payproof.domain.enums import CheckOutcome
from payproof.domain.rules.result import CheckResult, FixHint, evidence_for
from tests.domain.builders import evidence, snapshot
from tests.domain.test_enums import SPEC


def test_fix_hints_match_contract() -> None:
    match = re.search(r"fix_hint:\n\s+type: \[\"string\", \"null\"\]\n\s+enum: \[([^\]]+)\]", SPEC)
    assert match
    hints = [h.strip() for h in match.group(1).split(",") if h.strip() != "null"]
    assert [h.value for h in FixHint] == hints


def test_evidence_in_order_and_missing_paths_skipped() -> None:
    s = snapshot(evidence={"invoice.po_ref": evidence("invoice.po_ref")})
    assert evidence_for(s, "order.po_number", "invoice.po_ref") == (evidence("invoice.po_ref"),)


def test_result_defaults_and_is_frozen() -> None:
    r = CheckResult("R-001", CheckOutcome.PASS, "ok")
    assert (r.evidence, r.cascade, r.fix_hint, dict(r.data)) == ((), False, None, {})
    with pytest.raises(dataclasses.FrozenInstanceError):
        r.cascade = True  # type: ignore[misc]
