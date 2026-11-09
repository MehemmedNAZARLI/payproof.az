import uuid
from dataclasses import replace
from decimal import Decimal

from payproof.extraction.base import ExtractionInput, InvoiceData, LineData, validate
from payproof.extraction.mock import MockExtractionAdapter

INVOICE = InvoiceData(
    po_ref=None,
    po_raw=None,
    currency="AZN",
    total=Decimal("1500.00"),
    lines=(LineData("KY-10", Decimal(10), "ədəd", Decimal("150.00")),),
)
SRC = ExtractionInput(
    file_name="INV-1042_v2_PO-381.pdf",
    data=b"",
    doc_type="invoice",
    scanned=False,
    customer_id=uuid.uuid4(),
    customer="A Market MMC, VÖEN 1234567890",
    invoice=INVOICE,
    delivery=None,
)
mock = MockExtractionAdapter()


async def test_sample_correction_is_applied_with_evidence() -> None:
    r = await mock.extract(SRC)
    validate(r, pages=1)
    assert r.source == "mock" and r.invoice is not None
    assert (r.invoice.po_ref, r.invoice.unreadable, r.needs_review) == (
        "PO-381",
        frozenset(),
        False,
    )
    quotes = {e.field_path: e.quote for e in r.evidence}
    assert quotes["invoice.po_ref"] == "Sifariş №: PO-381"
    assert quotes["invoice.lines[KY-10].qty"] == "KY-10 — 10 ədəd × 150,00 AZN"


async def test_price_correction_recomputes_the_total() -> None:
    r = await mock.extract(replace(SRC, file_name="INV-1044_v2.pdf"))
    assert r.invoice is not None and r.invoice.lines[0].unit_price == Decimal("100.00")
    assert r.invoice.total == Decimal("1000.00")


async def test_scan_without_a_sample_leaves_the_po_for_a_person() -> None:
    r = await mock.extract(replace(SRC, file_name="INV-1047_v2.jpg", scanned=True))
    assert r.invoice is not None and r.needs_review and r.invoice.po_ref is None
    assert "oxunmur" in {e.field_path: e.quote for e in r.evidence}["invoice.po_ref"]


async def test_signed_delivery_sample() -> None:
    src = replace(SRC, file_name="TS-5531_imzali.pdf", doc_type="delivery")
    r = await mock.extract(src)
    validate(r, pages=1)
    assert r.delivery is not None and (r.delivery.note_number, r.delivery.signed) == (
        "TS-5531",
        True,
    )
    assert [li.qty for li in r.delivery.lines] == [Decimal(10)]


async def test_unknown_file_changes_nothing() -> None:
    r = await mock.extract(replace(SRC, file_name="note.pdf", doc_type="order"))
    assert (r.invoice, r.delivery, r.evidence) == (None, None, ())


async def test_new_package_documents_come_from_the_demo_sets() -> None:
    invoice = await mock.extract(replace(SRC, file_name="INV-1051.pdf", invoice=None))
    validate(invoice, pages=1)
    assert invoice.invoice is not None and not invoice.needs_review
    assert (invoice.invoice.po_ref, invoice.invoice.total) == ("PO-399", Decimal("1160.00"))
    delivery = await mock.extract(
        replace(SRC, file_name="TS-5547.jpg", doc_type="delivery", invoice=invoice.invoice)
    )
    assert delivery.delivery is not None
    assert (delivery.delivery.note_number, delivery.delivery.signed) == ("TS-5547", True)
