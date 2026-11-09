"""Invoice packages through the AI interface: the registry's `invoice` / `delivery` entries are
extracted like any configured type, then mapped onto the legacy invoice/delivery shape the
R-rules read. Unread or unsourced values stay unread — R-001…R-009 then answer UNKNOWN."""

import asyncio
import datetime as dt
import re
from decimal import Decimal, InvalidOperation
from typing import Any

import pymupdf

from payproof.domain.checks.values import normalize_name
from payproof.domain.rules.paths import (
    DELIVERY_CUSTOMER,
    DELIVERY_PO,
    DELIVERY_SIGNATURE,
    INVOICE_CUSTOMER,
    INVOICE_PO,
    INVOICE_TOTAL,
    line,
)
from payproof.extraction.base import (
    DeliveryData,
    Evidence,
    ExtractionInput,
    ExtractionResult,
    InvoiceData,
    LineData,
)
from payproof.extraction.generic import GenericData
from payproof.extraction.llm import LlmExtractor, LlmFile

_PO = re.compile(r"^PO-\d{3,}$")
_MIME = {b"%PDF-": "application/pdf", b"\x89PNG": "image/png", b"\xff\xd8\xff": "image/jpeg"}


def _decimal(v: Any) -> Decimal | None:
    try:
        return Decimal(str(v)) if v is not None else None
    except InvalidOperation:
        return None


def _text_layer(data: bytes) -> tuple[str, ...]:
    with pymupdf.open(stream=data, filetype="pdf") as doc:  # type: ignore[no-untyped-call]
        return tuple(page.get_text() for page in doc)


async def llm_file(src: ExtractionInput) -> LlmFile:
    """Pre-processing: a PDF with a text layer goes as text, anything else as the file itself."""
    mime = next((m for magic, m in _MIME.items() if src.data.startswith(magic)), "")
    text: tuple[str, ...] | None = None
    if mime == "application/pdf":
        try:
            text = await asyncio.to_thread(_text_layer, src.data)
        except (RuntimeError, ValueError):
            text = None  # unreadable PDF structure: the model reads the file itself
    pages = len(text) if text else 1
    if src.scanned or (text is not None and not any(t.strip() for t in text)):
        text = None  # no text layer: the model reads the page images
    return LlmFile(src.file_name, src.data, mime, pages, text)


def _cite(g: GenericData, key: str, path: str) -> list[Evidence]:
    e = g.evidence.get(key)
    return [Evidence(path, e["page"], e["quote"])] if e else []


def _lines(g: GenericData, doc: str, priced: bool) -> tuple[tuple[LineData, ...], list[Evidence]]:
    rows = g.tables.get("lines")
    if "lines" in g.unreadable or not rows or any(not r.get("code") for r in rows):
        return (), []  # unread lines: the line rules say UNKNOWN, never a vacuous PASS
    out, evidence = [], []
    for i, r in enumerate(rows):
        code = str(r["code"]).strip()
        unit = r.get("unit") if priced else "-"
        out.append(LineData(code, _decimal(r.get("qty")), unit,
                            _decimal(r.get("unit_price")) if priced else None))  # fmt: skip
        for f in ("qty", "unit_price") if priced else ("qty",):
            evidence += _cite(g, f"lines[{i}]", line(doc, code, f))
    return tuple(out), evidence


def to_invoice(g: GenericData) -> tuple[InvoiceData, list[Evidence]]:
    po = g.fields.get("po_ref")
    unread = {INVOICE_PO} if "po_ref" in g.unreadable or (po and not _PO.match(str(po))) else set()
    if "total" in g.unreadable:
        unread.add(INVOICE_TOTAL)
    lines, line_ev = _lines(g, "invoice", priced=True)
    ok_po = po if po and INVOICE_PO not in unread else None
    inv = InvoiceData(
        po_ref=ok_po, po_raw=None if ok_po else (str(po) if po else None),
        currency=g.fields.get("currency"), total=_decimal(g.fields.get("total")),
        lines=lines, unreadable=frozenset(unread),
    )  # fmt: skip
    evidence = _cite(g, "po_ref", INVOICE_PO) if ok_po else []
    evidence += _cite(g, "total", INVOICE_TOTAL) + _cite(g, "buyer", INVOICE_CUSTOMER)
    return inv, evidence + line_ev


def to_delivery(g: GenericData, src: ExtractionInput) -> tuple[DeliveryData, list[Evidence]]:
    receiver = g.fields.get("receiver") or {}
    same = receiver.get("name") and normalize_name(receiver["name"]) == normalize_name(
        src.customer.split(",")[0]
    )
    po = g.fields.get("po_ref")
    date = g.fields.get("delivery_date")
    lines, line_ev = _lines(g, "delivery", priced=False)
    note = DeliveryData(
        note_number=g.fields.get("note_number"), po_ref=po if po and _PO.match(str(po)) else None,
        customer_id=src.customer_id if same else None, signed=g.fields.get("signed"),
        delivery_date=dt.date.fromisoformat(date) if date else None,
        lines=lines,
    )  # fmt: skip
    evidence = _cite(g, "po_ref", DELIVERY_PO) if note.po_ref else []
    evidence += _cite(g, "receiver", DELIVERY_CUSTOMER) + _cite(g, "signed", DELIVERY_SIGNATURE)
    evidence += _cite(g, "note_number", "delivery.note_number")
    return note, evidence + line_ev


class LlmInvoiceAdapter:
    """ExtractionAdapter for invoice packages on AI_PROVIDER=anthropic|openai."""

    def __init__(self, extractor: LlmExtractor, types: dict[str, dict[str, Any]]) -> None:
        self.extractor, self.types = extractor, types

    async def extract(self, src: ExtractionInput) -> ExtractionResult:
        if src.doc_type not in ("invoice", "delivery"):
            return ExtractionResult("llm", warnings=("order documents are not extracted",))
        g = await self.extractor.extract(await llm_file(src), self.types[src.doc_type])
        if src.doc_type == "invoice":
            inv, ev = to_invoice(g)
            return ExtractionResult("llm", invoice=inv, evidence=tuple(ev))
        note, ev = to_delivery(g, src)
        return ExtractionResult("llm", delivery=note, evidence=tuple(ev))
