import datetime as dt
import uuid
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKeyConstraint,
    Integer,
    Numeric,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from payproof.repositories.models.identity import VOEN_CHECK
from payproof.repositories.orm import Base, TenantEntity


class Customer(TenantEntity, Base):
    __tablename__ = "customers"
    __table_args__ = (
        UniqueConstraint("company_id", "external_id"),
        UniqueConstraint("id", "company_id"),  # target of same-tenant composite FKs
        CheckConstraint(VOEN_CHECK, name="voen_format"),
    )

    name: Mapped[str] = mapped_column(Text)
    external_id: Mapped[str] = mapped_column(Text)
    voen: Mapped[str] = mapped_column(Text)


class RequirementSet(TenantEntity, Base):
    """Immutable (DB trigger): a rule change is a new version, see ADR-0009."""

    __tablename__ = "requirement_sets"
    __table_args__ = (
        UniqueConstraint("customer_id", "version"),
        # validation runs reference the rule set of the package's own customer
        UniqueConstraint("id", "customer_id", "company_id"),
        # customer must belong to the same company as the rule set
        ForeignKeyConstraint(
            ["customer_id", "company_id"], ["customers.id", "customers.company_id"]
        ),
        # approver must be a member of the same company (users are global)
        ForeignKeyConstraint(
            ["approved_by", "company_id"], ["memberships.user_id", "memberships.company_id"]
        ),
        CheckConstraint("version >= 1", name="version_positive"),
        CheckConstraint("tolerance BETWEEN 0 AND 1", name="tolerance_range"),
        CheckConstraint("length(reason) > 0", name="reason_present"),
    )

    customer_id: Mapped[uuid.UUID] = mapped_column()
    version: Mapped[int] = mapped_column(Integer)
    require_po: Mapped[bool] = mapped_column(Boolean)
    require_delivery: Mapped[bool] = mapped_column(Boolean)
    require_signature: Mapped[bool] = mapped_column(Boolean)
    tolerance: Mapped[Decimal] = mapped_column(Numeric(3, 2))
    effective_from: Mapped[dt.date] = mapped_column(Date)
    approved_by: Mapped[uuid.UUID] = mapped_column()
    reason: Mapped[str] = mapped_column(Text)
