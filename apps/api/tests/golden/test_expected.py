"""Golden: every fixture package gives exactly the status, checks and blockers in
fixtures/expected.json (computed by the prototype engine). Never edit expected.json to pass."""

import pytest

from payproof.seed.fixtures import EXPECTED, PACKAGES, blocker_list, outcome_of

CASES = sorted(EXPECTED["packages"].items())


def test_every_fixture_package_is_covered() -> None:
    assert {number for number, _ in CASES} == set(PACKAGES)
    assert len(CASES) == EXPECTED["counts"]["packages"] == 14


@pytest.mark.parametrize(("number", "expected"), CASES, ids=[n for n, _ in CASES])
def test_package_matches_expected(number: str, expected: dict[str, object]) -> None:
    status, checks = outcome_of(PACKAGES[number])
    assert status.value == expected["status"]
    assert {c.rule_id: c.outcome.value for c in checks} == expected["checks"]
    assert blocker_list(checks) == expected["blockers"]
    if "r005_diff" in expected:
        r005 = next(c for c in checks if c.rule_id == "R-005")
        assert r005.data["line_difference"]["amount"] == expected["r005_diff"]


def test_inv_1044_price_difference_is_500() -> None:
    _, checks = outcome_of(PACKAGES["INV-1044"])
    r005 = next(c for c in checks if c.rule_id == "R-005")
    assert r005.data["line_difference"] == {"amount": "500.00", "currency": "AZN"}
