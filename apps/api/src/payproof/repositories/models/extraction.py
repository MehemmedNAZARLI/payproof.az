"""Structured results read from a document version; NULL = not read (rules give UNKNOWN)."""

import datetime as dt
import uuid
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, Date, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from payproof.domain.enums import Currency
from payproof.repositories.orm import (
    MONEY,
    QTY,
    Base,
    TenantEntity,
    one_of,
    same_tenant_fk,
    tenant_key,
)


class ExtractedInvoice(TenantEntity, Base):
    __tablename__ = "extracted_invoices"
    __table_args__ = (
        UniqueConstraint("document_version_id"),
        tenant_key(),
        same_tenant_fk("document_version_id", "document_versions"),
        one_of("currency", Currency, "currency_known"),
    )

    document_version_id: Mapped[uuid.UUID] = mapped_column()
    po_ref: Mapped[str | None] = mapped_column(Text)  # normalised, e.g. "PO-381"
    po_raw: Mapped[str | None] = mapped_column(Text)  # as printed, if it differs
    total: Mapped[Decimal | None] = mapped_column(MONEY)
    currency: Mapped[str | None] = mapped_column(String(3))


class ExtractedInvoiceLine(TenantEntity, Base):
    __tablename__ = "extracted_invoice_lines"
    __table_args__ = (
        UniqueConstraint("extracted_invoice_id", "product_code"),
        same_tenant_fk("extracted_invoice_id", "extracted_invoices"),
        CheckConstraint("qty > 0", name="qty_positive"),
        CheckConstraint("unit_price >= 0", name="unit_price_not_negative"),
    )

    extracted_invoice_id: Mapped[uuid.UUID] = mapped_column()
    product_code: Mapped[str] = mapped_column(Text)
    qty: Mapped[Decimal | None] = mapped_column(QTY)
    unit: Mapped[str | None] = mapped_column(Text)
    unit_price: Mapped[Decimal | None] = mapped_column(MONEY)


class DeliveryNote(TenantEntity, Base):
    """Delivery/acceptance act (təhvil-təslim aktı) read from a document version."""

    __tablename__ = "delivery_notes"
    __table_args__ = (
        UniqueConstraint("document_version_id"),
        tenant_key(),
        same_tenant_fk("document_version_id", "document_versions"),
        same_tenant_fk("customer_id", "customers"),
    )

    document_version_id: Mapped[uuid.UUID] = mapped_column()
    note_number: Mapped[str | None] = mapped_column(Text)
    po_ref: Mapped[str | None] = mapped_column(Text)
    customer_id: Mapped[uuid.UUID | None] = mapped_column()
    signed: Mapped[bool | None] = mapped_column(Boolean)
    delivery_date: Mapped[dt.date | None] = mapped_column(Date)


class DeliveryNoteLine(TenantEntity, Base):
    __tablename__ = "delivery_note_lines"
    __table_args__ = (
        UniqueConstraint("delivery_note_id", "product_code"),
        same_tenant_fk("delivery_note_id", "delivery_notes"),
        CheckConstraint("qty > 0", name="qty_positive"),
    )

    delivery_note_id: Mapped[uuid.UUID] = mapped_column()
    product_code: Mapped[str] = mapped_column(Text)
    qty: Mapped[Decimal | None] = mapped_column(QTY)
