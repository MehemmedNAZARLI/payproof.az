"""`AI_PROVIDER=pdf`: the PDF text layer (PyMuPDF) or a CSV/XLSX table, read with simple
patterns. Whatever is not found stays unread (UNKNOWN for the rules, review for a person).
Images have no text layer: OCR is a separate adapter (ADR-0007)."""

import asyncio
import csv
import io
import re
from decimal import Decimal, InvalidOperation

import pymupdf
from openpyxl import load_workbook

from payproof.domain.rules.paths import INVOICE_PO, INVOICE_TOTAL, line
from payproof.extraction.base import (
    Evidence,
    ExtractionInput,
    ExtractionResult,
    InvoiceData,
    LineData,
)

_PO = re.compile(r"\b(PO-\d{3,})\b")
_CURRENCY = re.compile(r"\b(AZN|USD)\b")
_TOTAL = re.compile(r"(?:Yekun|Cəmi)\s*:?\s*([\d .]+,\d{2})")
# "KY-10  12  ədəd  100,00" — code, quantity, unit, unit price
_LINE = re.compile(r"^([A-Z]{2}-[\w-]+)\s+(\d+(?:,\d+)?)\s+(\S+)\s+([\d .]+,\d{2})\s*$")
_COLUMNS = ("product_code", "qty", "unit", "unit_price")


def _number(text: str) -> Decimal | None:
    """Azerbaijani format: `1.200,50` → 1200.50."""
    try:
        return Decimal(text.replace(" ", "").replace(".", "").replace(",", "."))
    except InvalidOperation:
        return None


def _pages(data: bytes) -> list[str]:
    with pymupdf.open(stream=data, filetype="pdf") as doc:  # type: ignore[no-untyped-call]
        return [page.get_text() for page in doc]


def _from_text(pages: list[str]) -> tuple[InvoiceData, list[Evidence]]:
    po = currency = total = None
    lines: list[LineData] = []
    evidence: list[Evidence] = []
    for no, text in enumerate(pages, start=1):
        for raw in text.splitlines():
            row = raw.strip()
            if po is None and (m := _PO.search(row)):
                po = m.group(1)
                evidence.append(Evidence(INVOICE_PO, no, row))
            if currency is None and (m := _CURRENCY.search(row)):
                currency = m.group(1)
            if total is None and (m := _TOTAL.search(row)):
                total = _number(m.group(1))
                evidence.append(Evidence(INVOICE_TOTAL, no, row))
            if m := _LINE.match(row):
                code = m.group(1)
                lines.append(LineData(code, _number(m.group(2)), m.group(3), _number(m.group(4))))
                for field in ("qty", "unit_price"):
                    evidence.append(Evidence(line("invoice", code, field), no, row))
    unread = frozenset() if po else frozenset({INVOICE_PO})
    return InvoiceData(po, None, currency, total, tuple(lines), unread), evidence


def _rows(data: bytes, xlsx: bool) -> list[list[str]]:
    if xlsx:  # read_only + data_only: values only; formulas and macros never run
        book = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        sheet = book.worksheets[0]
        return [["" if c is None else str(c) for c in r] for r in sheet.iter_rows(values_only=True)]
    text = data.decode("utf-8-sig")
    return list(csv.reader(io.StringIO(text), delimiter=";" if ";" in text.split("\n")[0] else ","))


def _from_table(rows: list[list[str]]) -> tuple[InvoiceData, list[Evidence]]:
    header = [h.strip().lower() for h in rows[0]] if rows else []
    if not set(_COLUMNS) <= set(header):
        return InvoiceData(None, None, None, None, (), frozenset({INVOICE_PO})), []
    at = {c: header.index(c) for c in _COLUMNS}
    lines = tuple(
        LineData(r[at["product_code"]].strip(), _number(r[at["qty"]]), r[at["unit"]].strip()
                 or None, _number(r[at["unit_price"]]))
        for r in rows[1:]
        if len(r) >= len(header) and r[at["product_code"]].strip()
    )  # fmt: skip
    evidence = [
        Evidence(line("invoice", li.product_code, f), 1, ";".join(rows[i + 1]))
        for i, li in enumerate(lines)
        for f in ("qty", "unit_price")
    ]
    return InvoiceData(None, None, None, None, lines, frozenset({INVOICE_PO})), evidence


class PdfTextAdapter:
    async def extract(self, src: ExtractionInput) -> ExtractionResult:
        if src.doc_type != "invoice" or src.scanned:
            return ExtractionResult("pdf", warnings=("no text layer or not an invoice",))
        if src.data.startswith(b"%PDF-"):
            invoice, evidence = _from_text(await asyncio.to_thread(_pages, src.data))
        else:
            xlsx = src.data.startswith(b"PK")
            invoice, evidence = _from_table(await asyncio.to_thread(_rows, src.data, xlsx))
        return ExtractionResult("pdf", invoice=invoice, evidence=tuple(evidence))
