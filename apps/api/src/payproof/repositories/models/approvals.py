import datetime as dt
import uuid
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKeyConstraint,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    text,
    true,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from payproof.repositories.orm import Base, TenantEntity, member_fk, tenant_key

RUN_KEY = ("id", "package_id", "package_version", "requirement_set_id", "company_id")


class ApprovalRecord(TenantEntity, Base):
    """Human approval of one package version under one rule set — never a payment approval."""

    __tablename__ = "approval_records"
    __table_args__ = (
        tenant_key(),
        UniqueConstraint("id", "package_id", "package_version", "company_id"),  # export FK
        # the approval is bound to exactly the run it saw: same package, version and rule set
        ForeignKeyConstraint(
            [
                "validation_run_id",
                "package_id",
                "package_version",
                "requirement_set_id",
                "company_id",
            ],
            [f"validation_runs.{c}" for c in RUN_KEY],
        ),
        member_fk("approver_id"),
        # invalidated (version bump, rule change) approvals stay for audit with when and why
        CheckConstraint("valid = (invalidated_at IS NULL)", name="invalidated_at_set"),
        CheckConstraint(
            "valid OR coalesce(length(invalidated_reason), 0) > 0", name="invalidated_reason_set"
        ),
        Index(
            "uq_approval_records_valid_version",
            "package_id",
            "package_version",
            unique=True,
            postgresql_where=text("valid"),
        ),
    )

    validation_run_id: Mapped[uuid.UUID] = mapped_column()
    package_id: Mapped[uuid.UUID] = mapped_column()
    package_version: Mapped[int] = mapped_column(Integer)
    requirement_set_id: Mapped[uuid.UUID] = mapped_column()
    approver_id: Mapped[uuid.UUID] = mapped_column()
    valid: Mapped[bool] = mapped_column(Boolean, server_default=true())
    invalidated_reason: Mapped[str | None] = mapped_column(Text)
    invalidated_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))


class ExportRecord(TenantEntity, Base):
    """The exported package of one approved version (EXPORTED = downloaded, not sent or paid)."""

    __tablename__ = "export_records"
    __table_args__ = (
        UniqueConstraint("package_id", "package_version"),
        ForeignKeyConstraint(
            ["approval_id", "package_id", "package_version", "company_id"],
            [
                f"approval_records.{c}"
                for c in ("id", "package_id", "package_version", "company_id")
            ],
        ),
        member_fk("created_by"),
        CheckConstraint(
            "jsonb_typeof(files) = 'array' AND jsonb_array_length(files) > 0", name="files_present"
        ),
    )

    package_id: Mapped[uuid.UUID] = mapped_column()
    package_version: Mapped[int] = mapped_column(Integer)
    approval_id: Mapped[uuid.UUID] = mapped_column()
    files: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)  # selected document versions
    manifest_key: Mapped[str] = mapped_column(Text)
    created_by: Mapped[uuid.UUID] = mapped_column()
