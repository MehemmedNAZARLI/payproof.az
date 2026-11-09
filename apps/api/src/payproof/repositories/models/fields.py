import uuid
from typing import Any

from sqlalchemy import CheckConstraint, Integer, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from payproof.repositories.orm import Base, TenantEntity, member_fk, one_of, same_tenant_fk

# shortcut: mirrors `ExtractedField.review_status` in openapi.yaml; move to domain.enums when
# B-15/B-18 code branches on it
REVIEW_STATUSES = ("EXTRACTED", "REVIEW_REQUIRED", "CORRECTED")
MIN_REASON_LENGTH = 5  # B-18: a correction needs a reason of at least 5 characters


class ExtractedField(TenantEntity, Base):
    """One extracted value by path (`invoice.po_ref`, `invoice.lines[KY-10].qty`)."""

    __tablename__ = "extracted_fields"
    __table_args__ = (
        UniqueConstraint("document_version_id", "field_path"),
        same_tenant_fk("document_version_id", "document_versions"),
        member_fk("corrected_by"),
        one_of("review_status", REVIEW_STATUSES, "review_status_known"),
        # a correction always records who did it and why (audit); the document itself is unchanged
        CheckConstraint(
            "(review_status = 'CORRECTED') = (corrected_by IS NOT NULL)", name="corrected_by_set"
        ),
        CheckConstraint(
            "review_status <> 'CORRECTED'"
            f" OR coalesce(length(correction_reason), 0) >= {MIN_REASON_LENGTH}",
            name="correction_reason_set",
        ),
    )

    document_version_id: Mapped[uuid.UUID] = mapped_column()
    field_path: Mapped[str] = mapped_column(Text)
    raw_value: Mapped[str | None] = mapped_column(Text)
    normalized_value: Mapped[str | None] = mapped_column(Text)
    review_status: Mapped[str] = mapped_column(Text, server_default="EXTRACTED")
    corrected_by: Mapped[uuid.UUID | None] = mapped_column()
    correction_reason: Mapped[str | None] = mapped_column(Text)


class EvidenceRef(TenantEntity, Base):
    """Source of a field (page + quote); a field without evidence is not trusted."""

    __tablename__ = "evidence_refs"
    __table_args__ = (
        same_tenant_fk("document_version_id", "document_versions"),
        CheckConstraint("page >= 1", name="page_positive"),
        # normalised [x, y, width, height]; page-range check is done at extraction, B-15
        CheckConstraint(
            "bbox IS NULL OR (jsonb_typeof(bbox) = 'array' AND jsonb_array_length(bbox) = 4)",
            name="bbox_shape",
        ),
    )

    document_version_id: Mapped[uuid.UUID] = mapped_column()
    field_path: Mapped[str] = mapped_column(Text)
    page: Mapped[int] = mapped_column(Integer)
    quote: Mapped[str] = mapped_column(Text)
    # none_as_null: Python None is SQL NULL here, not the JSON value `null`
    bbox: Mapped[list[Any] | None] = mapped_column(JSONB(none_as_null=True))
