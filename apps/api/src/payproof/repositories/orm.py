import uuid
from collections.abc import Iterable
from datetime import datetime
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    MetaData,
    Numeric,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, declared_attr, mapped_column

from payproof.core.ids import uuid7

TENANT_COLUMN = "payproof.tenant"

# stable constraint names so Alembic migrations can drop/alter them
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class IdMixin:
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid7)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class TenantMixin:
    """Business tables: `company_id` is set from the session's membership, never from input."""

    @declared_attr
    def company_id(cls) -> Mapped[uuid.UUID]:
        # info marker lets the tenant guard spot these tables anywhere in a statement
        return mapped_column(
            Uuid, ForeignKey("companies.id"), index=True, info={TENANT_COLUMN: True}
        )


class TenantEntity(IdMixin, TimestampMixin, TenantMixin):
    """Default columns of a business table: `class Customer(TenantEntity, Base)`."""


# data-model.md: money NUMERIC(18,2) + currency, quantity NUMERIC(18,3); never float
MONEY = Numeric(18, 2)
QTY = Numeric(18, 3)


def one_of(column: str, values: Iterable[str], name: str) -> CheckConstraint:
    """Enum as TEXT + CHECK (data-model.md); NULL passes, so pair with NOT NULL if required.
    `values` is a domain StrEnum class or a tuple of plain strings."""
    return CheckConstraint(f"{column} IN ({', '.join(f"'{v}'" for v in values)})", name=name)


def tenant_key() -> UniqueConstraint:
    """`(id, company_id)` unique: lets children reference this row with `same_tenant_fk`."""
    return UniqueConstraint("id", "company_id")


def same_tenant_fk(
    column: str, target: str, target_column: str = "id", **kw: Any
) -> ForeignKeyConstraint:
    """`column` must point at a row of the *same* company (target needs `tenant_key()`)."""
    return ForeignKeyConstraint(
        [column, "company_id"], [f"{target}.{target_column}", f"{target}.company_id"], **kw
    )


def member_fk(column: str) -> ForeignKeyConstraint:
    """A user reference: users are global, so the user must be a member of this company."""
    return same_tenant_fk(column, "memberships", "user_id")
