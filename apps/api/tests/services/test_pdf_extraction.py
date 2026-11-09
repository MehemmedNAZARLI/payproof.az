import io
import uuid
from decimal import Decimal

import pymupdf
from openpyxl import Workbook

from payproof.extraction.base import ExtractionInput, LineData, validate
from payproof.extraction.pdf import PdfTextAdapter

adapter = PdfTextAdapter()


def _src(data: bytes, doc_type: str = "invoice") -> ExtractionInput:
    return ExtractionInput("f", data, doc_type, False, uuid.uuid4(), "A MMC", None, None)


def _pdf(*pages: str) -> bytes:
    """ASCII text only: the built-in PDF font has no Azerbaijani letters (a test limit; real
    invoices embed their fonts)."""
    doc = pymupdf.open()  # type: ignore[no-untyped-call]
    for text in pages:
        doc.new_page().insert_text((72, 72), text)
    return bytes(doc.tobytes())  # type: ignore[no-untyped-call]


async def test_pdf_text_layer() -> None:
    data = _pdf("Faktura INV-1042\nPO: PO-381\nValyuta: AZN", "KY-10 12 kg 100,00\nYekun: 1.200,00")
    r = await adapter.extract(_src(data))
    validate(r, pages=2)
    assert r.invoice is not None and not r.needs_review
    assert (r.invoice.po_ref, r.invoice.currency, r.invoice.total) == (
        "PO-381",
        "AZN",
        Decimal("1200.00"),
    )
    assert r.invoice.lines == (LineData("KY-10", Decimal(12), "kg", Decimal("100.00")),)
    pages = {e.field_path: e.page for e in r.evidence}
    assert (pages["invoice.po_ref"], pages["invoice.lines[KY-10].qty"]) == (1, 2)


async def test_missing_po_is_left_for_review() -> None:
    r = await adapter.extract(_src(_pdf("KY-10 12 kg 100,00")))
    assert r.invoice is not None and r.needs_review and r.invoice.po_ref is None


async def test_csv_and_xlsx_tables() -> None:
    csv = "product_code;qty;unit;unit_price\nKY-10;12;ədəd;100,00\nMS-05;3;;5,50\n".encode()
    r = await adapter.extract(_src(csv))
    assert r.invoice is not None and r.invoice.lines[1] == LineData(
        "MS-05", Decimal(3), None, Decimal("5.50")
    )

    book = Workbook()
    sheet = book.active
    assert sheet is not None
    sheet.append(["product_code", "qty", "unit", "unit_price"])
    sheet.append(["KY-10", "12", "ədəd", "100,00"])
    buf = io.BytesIO()
    book.save(buf)
    x = await adapter.extract(_src(buf.getvalue()))
    assert x.invoice is not None and x.invoice.lines[0].unit == "ədəd"


async def test_scans_and_other_documents_are_not_read() -> None:
    r = await adapter.extract(_src(_pdf("TS-5531"), doc_type="delivery"))
    assert (r.invoice, r.evidence) == (None, ())
