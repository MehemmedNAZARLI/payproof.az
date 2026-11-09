import uuid

from sqlalchemy import BigInteger, CheckConstraint, Integer, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from payproof.domain.enums import DocumentStatus
from payproof.repositories.orm import (
    Base,
    TenantEntity,
    member_fk,
    one_of,
    same_tenant_fk,
    tenant_key,
)

# shortcut: mirror openapi.yaml enums that B-06 did not move into domain.enums; move them
# there when a rule or service needs them
DOCUMENT_TYPES = ("invoice", "order", "delivery")
SOURCE_KINDS = ("pdf", "scan", "spreadsheet")


class Document(TenantEntity, Base):
    __tablename__ = "documents"
    __table_args__ = (
        UniqueConstraint("package_id", "type"),
        tenant_key(),
        same_tenant_fk("package_id", "invoice_packages"),
        one_of("type", DOCUMENT_TYPES, "type_known"),
    )

    package_id: Mapped[uuid.UUID] = mapped_column()
    type: Mapped[str] = mapped_column(Text)


class DocumentVersion(TenantEntity, Base):
    """Every upload is a new version; old ones stay for audit. Uploaded at = `created_at`."""

    __tablename__ = "document_versions"
    __table_args__ = (
        UniqueConstraint("document_id", "version_no"),
        tenant_key(),
        same_tenant_fk("document_id", "documents"),
        member_fk("uploaded_by"),
        one_of("status", DocumentStatus, "status_known"),
        one_of("source_kind", SOURCE_KINDS, "source_kind_known"),
        CheckConstraint("version_no >= 1", name="version_no_positive"),
        CheckConstraint("sha256 ~ '^[0-9a-f]{64}$'", name="sha256_hex"),
        CheckConstraint("size > 0", name="size_positive"),
        CheckConstraint("pages >= 1", name="pages_positive"),
        CheckConstraint("package_version_at_upload >= 1", name="package_version_positive"),
    )

    document_id: Mapped[uuid.UUID] = mapped_column()
    version_no: Mapped[int] = mapped_column(Integer)
    file_name: Mapped[str] = mapped_column(Text)
    storage_key: Mapped[str] = mapped_column(Text, unique=True)
    # duplicate check (same sha256 within a package) is done by the upload service, B-13
    sha256: Mapped[str] = mapped_column(Text)
    mime: Mapped[str] = mapped_column(Text)
    size: Mapped[int] = mapped_column(BigInteger)
    pages: Mapped[int | None] = mapped_column(Integer)
    source_kind: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, server_default="UPLOADED")
    uploaded_by: Mapped[uuid.UUID] = mapped_column()
    package_version_at_upload: Mapped[int] = mapped_column(Integer)
