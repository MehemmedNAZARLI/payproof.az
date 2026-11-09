"""Rule-engine input (docs/architecture/rules-engine.md): plain data, built from the DB by a
service and never from ORM objects inside rules. `None` means "not read" -> rules give UNKNOWN."""

import uuid
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from decimal import Decimal

from payproof.domain.enums import Currency
from payproof.domain.money import Money


@dataclass(frozen=True)
class EvidenceRef:
    """Where a value was read: document version, page and quote (bbox: normalised x, y, w, h)."""

    document_version_id: uuid.UUID
    page: int
    quote: str
    bbox: tuple[float, float, float, float] | None


@dataclass(frozen=True)
class InvoiceLine:
    code: str
    qty: Decimal | None
    unit: str | None
    unit_price: Money | None


@dataclass(frozen=True)
class Invoice:
    po_ref: str | None  # normalised "PO-381"
    po_raw: str | None  # as printed when it could not be normalised ("PO-3?7")
    unreadable_fields: frozenset[str]  # field paths, e.g. "invoice.po_ref"
    lines: tuple[InvoiceLine, ...]
    total: Money | None


@dataclass(frozen=True)
class OrderLine:
    code: str
    qty: Decimal
    unit: str | None
    unit_price: Money


@dataclass(frozen=True)
class Order:
    """Present only when the link is confirmed (human or exact PO id)."""

    po: str
    customer_id: uuid.UUID
    currency: Currency
    lines: tuple[OrderLine, ...]


@dataclass(frozen=True)
class DeliveryLine:
    code: str
    qty: Decimal | None


@dataclass(frozen=True)
class Delivery:
    no: str | None
    po_ref: str | None
    customer_id: uuid.UUID | None
    lines: tuple[DeliveryLine, ...]
    signed: bool | None


@dataclass(frozen=True)
class Rules:
    """The customer's rule set version in force for this evaluation."""

    require_po: bool
    require_delivery: bool
    require_signature: bool
    tolerance: Decimal  # R-009, in the invoice currency

    def __post_init__(self) -> None:
        if not Decimal(0) <= self.tolerance <= Decimal(1):
            raise ValueError(f"tolerance must be 0.00-1.00, got {self.tolerance}")


@dataclass(frozen=True)
class Party:
    """Buyer display data for messages (R-003 names both buyers when they differ)."""

    name: str
    voen: str


@dataclass(frozen=True)
class PackageSnapshot:
    currency: Currency
    customer_id: uuid.UUID
    invoice: Invoice
    order: Order | None
    candidates: tuple[str, ...]  # PO numbers suggested while the link is not confirmed
    delivery: Delivery | None
    signature_reviewed: bool
    rules: Rules
    parties: Mapping[uuid.UUID, Party]  # every customer id referenced above
    evidence: Mapping[str, EvidenceRef] = field(default_factory=dict)  # by field path

    def __post_init__(self) -> None:
        referenced = {self.customer_id}
        referenced |= {self.order.customer_id} if self.order else set()
        if self.delivery is not None and self.delivery.customer_id is not None:
            referenced.add(self.delivery.customer_id)
        if missing := referenced - set(self.parties):
            raise ValueError(f"no party data for customers {sorted(map(str, missing))}")
        inv = self.invoice
        _same_currency([inv.total, *(line.unit_price for line in inv.lines)], self.currency)
        _unique_codes(line.code for line in inv.lines)
        if self.order is not None:
            if self.candidates:
                raise ValueError("a confirmed order leaves no candidates")
            _same_currency((line.unit_price for line in self.order.lines), self.order.currency)
            _unique_codes(line.code for line in self.order.lines)
        if self.delivery is not None:
            _unique_codes(line.code for line in self.delivery.lines)


def _same_currency(amounts: Iterable[Money | None], currency: Currency) -> None:
    for amount in amounts:
        if amount is not None and amount.currency != currency:
            raise ValueError(f"{amount!r} is not in the document currency {currency}")


def _unique_codes(codes: Iterable[str]) -> None:
    seen: set[str] = set()
    for code in codes:
        if code in seen:
            raise ValueError(f"duplicate line for product {code}")  # rules address lines by code
        seen.add(code)
