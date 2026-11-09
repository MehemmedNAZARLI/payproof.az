import datetime as dt
import uuid
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, String, Text, UniqueConstraint
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


class Order(TenantEntity, Base):
    """Customer purchase order (PO) — the reference the invoice is matched against."""

    __tablename__ = "orders"
    __table_args__ = (
        UniqueConstraint("company_id", "po_number"),
        tenant_key(),
        same_tenant_fk("customer_id", "customers"),
        one_of("currency", Currency, "currency_known"),
    )

    customer_id: Mapped[uuid.UUID] = mapped_column()
    po_number: Mapped[str] = mapped_column(Text)
    currency: Mapped[str] = mapped_column(String(3))
    order_date: Mapped[dt.date] = mapped_column(Date)


class OrderLine(TenantEntity, Base):
    __tablename__ = "order_lines"
    __table_args__ = (
        UniqueConstraint("order_id", "product_code"),  # rules address lines by product code
        same_tenant_fk("order_id", "orders"),
        CheckConstraint("qty > 0", name="qty_positive"),
        CheckConstraint("unit_price >= 0", name="unit_price_not_negative"),
    )

    order_id: Mapped[uuid.UUID] = mapped_column()
    product_code: Mapped[str] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    qty: Mapped[Decimal] = mapped_column(QTY)
    unit: Mapped[str | None] = mapped_column(Text)
    unit_price: Mapped[Decimal] = mapped_column(MONEY)
