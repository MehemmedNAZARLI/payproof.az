"""Configurable document sets (ADR-0011): the document type registry and customer templates."""

import uuid
from typing import Any

from sqlalchemy import BigInteger, Boolean, CheckConstraint, Integer, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from payproof.repositories.orm import (
    Base,
    IdMixin,
    TenantEntity,
    TimestampMixin,
    member_fk,
    same_tenant_fk,
    tenant_key,
)

DOCUMENT_TYPE_KEY = "^[a-z][a-z0-9_]{1,39}$"  # openapi DocumentTypeKey


class DocumentTypeEntry(IdMixin, TimestampMixin, Base):
    """One version of a registry entry. Shared by every company (configuration, not tenant
    data) and immutable: a schema change is a new `version`; stored extractions keep theirs."""

    __tablename__ = "document_types"
    __table_args__ = (
        UniqueConstraint("key", "version"),
        CheckConstraint(f"key ~ '{DOCUMENT_TYPE_KEY}'", name="key_format"),
        CheckConstraint("version >= 1", name="version_positive"),
        CheckConstraint("jsonb_typeof(extraction) = 'object'", name="extraction_is_object"),
    )

    key: Mapped[str] = mapped_column(Text)
    version: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(Text)
    builtin: Mapped[bool] = mapped_column(Boolean)
    accepted_formats: Mapped[list[str]] = mapped_column(ARRAY(Text))
    extraction: Mapped[dict[str, Any]] = mapped_column(JSONB)
    instructions: Mapped[str] = mapped_column(Text)


class OutputTemplate(TenantEntity, Base):
    """A customer's `.docx` output template; a requirement set references it by sha256."""

    __tablename__ = "output_templates"
    __table_args__ = (
        UniqueConstraint("customer_id", "sha256"),
        tenant_key(),
        same_tenant_fk("customer_id", "customers"),
        member_fk("uploaded_by"),
        CheckConstraint("sha256 ~ '^[0-9a-f]{64}$'", name="sha256_hex"),
        CheckConstraint("size > 0", name="size_positive"),
    )

    customer_id: Mapped[uuid.UUID] = mapped_column()
    file_name: Mapped[str] = mapped_column(Text)
    sha256: Mapped[str] = mapped_column(Text)
    size: Mapped[int] = mapped_column(BigInteger)
    storage_key: Mapped[str] = mapped_column(Text, unique=True)
    placeholders: Mapped[list[str]] = mapped_column(ARRAY(Text))
    uploaded_by: Mapped[uuid.UUID] = mapped_column()
