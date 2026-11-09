"""Extraction behind an adapter (ADR-0007). Every result passes `validate()` — schema and
source checks — before anything is stored; the rules only ever see the stored fields."""

import datetime as dt
import uuid
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Literal, Protocol

from payproof.domain.enums import Currency
from payproof.domain.rules.paths import (
    DELIVERY_CUSTOMER,
    DELIVERY_PO,
    DELIVERY_SIGNATURE,
    INVOICE_CUSTOMER,
    INVOICE_PO,
    INVOICE_TOTAL,
)

Source = Literal["mock", "pdf", "llm"]
_MAX = Decimal("9999999999999999.99")  # NUMERIC(18,2)
_FIELDS = {INVOICE_PO, INVOICE_CUSTOMER, INVOICE_TOTAL, DELIVERY_PO, DELIVERY_CUSTOMER}
_FIELDS |= {DELIVERY_SIGNATURE, "delivery.note_number"}


class InvalidExtraction(ValueError):
    """The adapter's output broke the schema or cited a source that does not exist."""


@dataclass(frozen=True)
class LineData:
    product_code: str
    qty: Decimal | None  # None = not read
    unit: str | None  # None = not read (R-004 → UNKNOWN)
    unit_price: Decimal | None = None


@dataclass(frozen=True)
class InvoiceData:
    po_ref: str | None
    po_raw: str | None  # as printed, when it could not be normalised
    currency: str | None
    total: Decimal | None
    lines: tuple[LineData, ...]
    unreadable: frozenset[str] = frozenset()  # field paths a person has to read


@dataclass(frozen=True)
class DeliveryData:
    note_number: str | None
    po_ref: str | None
    customer_id: uuid.UUID | None
    signed: bool | None
    delivery_date: dt.date | None
    lines: tuple[LineData, ...]


@dataclass(frozen=True)
class Evidence:
    field_path: str
    page: int
    quote: str
    bbox: tuple[float, float, float, float] | None = None


@dataclass(frozen=True)
class ExtractionResult:
    source: Source
    invoice: InvoiceData | None = None
    delivery: DeliveryData | None = None
    evidence: tuple[Evidence, ...] = ()
    warnings: tuple[str, ...] = field(default=())

    @property
    def needs_review(self) -> bool:
        return bool(self.invoice and self.invoice.unreadable)


@dataclass(frozen=True)
class ExtractionInput:
    """The file, plus the package's current stored extraction (the mock adapter applies its
    sample delta on top of it; real adapters read the file)."""

    file_name: str
    data: bytes
    doc_type: str
    scanned: bool  # image: no text layer
    customer_id: uuid.UUID
    customer: str  # "name, VÖEN ..." for evidence quotes
    invoice: InvoiceData | None  # current, before this version
    delivery: DeliveryData | None


class ExtractionAdapter(Protocol):
    async def extract(self, src: ExtractionInput) -> ExtractionResult: ...


def _known(path: str) -> bool:
    if path in _FIELDS:
        return True
    head, _, rest = path.partition(".lines[")
    return head in {"invoice", "delivery"} and rest.split("].")[-1] in {"qty", "unit_price"}


def _amount(value: Decimal | None, what: str, places: int) -> None:
    if value is None:
        return
    if value < 0 or value > _MAX or value != round(value, places):
        raise InvalidExtraction(f"{what} out of range")


def _lines(lines: tuple[LineData, ...], what: str) -> None:
    for li in lines:
        if not li.product_code.strip():
            raise InvalidExtraction(f"{what} line without a product code")
        _amount(li.qty, f"{what} qty", 3)
        _amount(li.unit_price, f"{what} unit price", 2)


def validate(r: ExtractionResult, pages: int) -> None:
    for e in r.evidence:
        if not 1 <= e.page <= pages:
            raise InvalidExtraction(f"evidence on page {e.page} of a {pages}-page file")
        if not _known(e.field_path):
            raise InvalidExtraction(f"evidence for unknown field {e.field_path}")
    if inv := r.invoice:
        if inv.currency is not None and inv.currency not in set(Currency):
            raise InvalidExtraction(f"currency {inv.currency} not supported")
        _amount(inv.total, "total", 2)
        _lines(inv.lines, "invoice")
    if r.delivery:
        _lines(r.delivery.lines, "delivery")
