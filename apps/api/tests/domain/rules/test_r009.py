from decimal import Decimal

import pytest

from payproof.domain.enums import CheckOutcome as O
from payproof.domain.rules.r009 import r009
from payproof.domain.rules.result import FixHint
from payproof.domain.snapshot import InvoiceLine
from tests.domain.builders import azn, evidence, invoice, rules, snapshot


def test_sum_matches_total() -> None:
    # 800 x 9.00 + 400 x 12.00 = 12000.00
    r = r009(snapshot())
    assert (r.rule_id, r.outcome, r.message) == (
        "R-009",
        O.PASS,
        "Sətirlərin cəmi 12.000,00 AZN yekun məbləğə uyğundur.",
    )
    assert r.evidence == (evidence("invoice.total"),)


@pytest.mark.parametrize(
    ("total", "outcome"),
    [("12000.01", O.PASS), ("11999.99", O.PASS), ("12000.02", O.FAIL)],
    ids=["+tol", "-tol", "beyond"],
)
def test_tolerance_is_inclusive(total: str, outcome: O) -> None:
    assert r009(snapshot(invoice=invoice(total=azn(total)))).outcome is outcome


def test_zero_tolerance() -> None:
    s = snapshot(invoice=invoice(total=azn("12000.01")), rules=rules(tolerance=Decimal("0")))
    assert r009(s).outcome is O.FAIL


def test_mismatch_fails_with_difference() -> None:
    r = r009(snapshot(invoice=invoice(total=azn("12500.00"))))
    assert (r.outcome, r.fix_hint) == (O.FAIL, FixHint.UPLOAD_INVOICE)
    assert r.message == (
        "Sətirlərin cəmi 12.000,00 AZN, fakturadakı yekun 12.500,00 AZN. Fərq: −500,00 AZN."
    )


@pytest.mark.parametrize("which", ["total", "line"])
def test_unread_amount_is_unknown_not_pass(which: str) -> None:
    inv = (
        invoice(total=None)
        if which == "total"
        else invoice(lines=(InvoiceLine("GY-1L", Decimal("800"), "ədəd", None),))
    )
    r = r009(snapshot(invoice=inv))
    assert (r.outcome, r.fix_hint) == (O.UNKNOWN, FixHint.EDIT_FIELD)
    assert r.message == (
        "Sətirlərin cəmi və ya yekun məbləğ oxunmadı. Mənbəyə baxıb sahəni təsdiqləyin."
    )
