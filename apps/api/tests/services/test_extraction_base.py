from decimal import Decimal

import pytest

from payproof.extraction.base import (
    Evidence,
    ExtractionResult,
    InvalidExtraction,
    InvoiceData,
    LineData,
    validate,
)


def _result(page: int = 1, **over: object) -> ExtractionResult:
    invoice = InvoiceData(
        po_ref="PO-381",
        po_raw=None,
        currency="AZN",
        total=Decimal("1200.00"),
        lines=(LineData("KY-10", Decimal(12), "ədəd", Decimal("100.00")),),
    )
    fields: dict[str, object] = {
        "source": "mock",
        "invoice": invoice,
        "evidence": (Evidence("invoice.po_ref", page, "Sifariş №: PO-381"),),
    }
    return ExtractionResult(**{**fields, **over})  # type: ignore[arg-type]


def test_valid_result_passes() -> None:
    validate(_result(), pages=2)


@pytest.mark.parametrize("page", [0, 3])
def test_evidence_must_point_at_a_real_page(page: int) -> None:
    with pytest.raises(InvalidExtraction, match="page"):
        validate(_result(page), pages=2)


def test_evidence_must_name_a_known_field() -> None:
    bad = _result(evidence=(Evidence("invoice.iban", 1, "AZ00"),))
    with pytest.raises(InvalidExtraction, match="field"):
        validate(bad, pages=1)


def test_money_and_quantities_must_be_in_range() -> None:
    line = LineData("KY-10", Decimal("-1"), "ədəd", Decimal("100.001"))
    invoice = InvoiceData("PO-1", None, "AZN", Decimal("1"), (line,))
    with pytest.raises(InvalidExtraction):
        validate(_result(invoice=invoice, evidence=()), pages=1)
    with pytest.raises(InvalidExtraction, match="currency"):
        validate(_result(invoice=InvoiceData("PO-1", None, "EUR", None, ()), evidence=()), 1)
