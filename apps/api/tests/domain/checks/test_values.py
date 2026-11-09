from decimal import Decimal

import pytest

from payproof.domain.checks.template import fill_template
from payproof.domain.checks.values import MONEY, amount, decimal_str, js_str, same_counterparty


def test_money_pattern_matches_like_javascript() -> None:
    assert MONEY.match("100.00") and not MONEY.match("100.00\n")  # JS `$` has no newline slack
    with pytest.raises(ValueError):
        amount("100.00\n")


def test_js_string_conversion_and_signless_zero() -> None:
    assert (js_str(None), js_str(True), js_str({"a": 1}), js_str(["a", None])) == (
        "null", "true", "[object Object]", "a,")  # fmt: skip
    assert decimal_str(Decimal("-0.00")) == "0.00" and decimal_str(Decimal("-5.10")) == "-5.10"


def test_counterparty_names_are_normalized_for_azerbaijani() -> None:
    assert same_counterparty("Kitab Evi MMC", "KITAB EVI MMC")
    assert same_counterparty("Texno Market MMC", "TEXNO MARKET")
    assert not same_counterparty("Kitab", "Kitab Evi")  # too short to contain-match


def test_missing_reference_is_a_missing_placeholder() -> None:
    rs = {"output": {"placeholders": [{"placeholder": "{{ref}}",
                                       "source": {"kind": "package", "value": "reference"}}]}}  # fmt: skip
    assert fill_template({"documents": [], "reference": None}, rs, None)["missing"]
