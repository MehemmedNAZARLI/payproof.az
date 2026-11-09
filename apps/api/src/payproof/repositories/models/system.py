import datetime as dt
import uuid
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from payproof.repositories.orm import (
    Base,
    IdMixin,
    TenantEntity,
    TimestampMixin,
    member_fk,
    one_of,
    same_tenant_fk,
)

# shortcut: mirror `Job.kind` / `Job.status` in openapi.yaml; move to domain.enums when B-14
# code branches on them
JOB_KINDS = ("extract_document", "create_package")
JOB_STATUSES = ("QUEUED", "RUNNING", "SUCCEEDED", "FAILED")


class Notification(TenantEntity, Base):
    __tablename__ = "notifications"
    __table_args__ = (
        member_fk("user_id"),
        same_tenant_fk("package_id", "invoice_packages"),
        CheckConstraint("length(text) > 0", name="text_present"),
        Index("ix_notifications_unread", "user_id", postgresql_where=text("read_at IS NULL")),
    )

    user_id: Mapped[uuid.UUID] = mapped_column()
    package_id: Mapped[uuid.UUID | None] = mapped_column()
    text: Mapped[str] = mapped_column(Text)
    read_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))


class Job(IdMixin, TimestampMixin, Base):
    """Worker queue (ADR-0005). Not tenant-guarded: the worker claims jobs of every company,
    so tenant-facing reads (`GET /v1/jobs/{id}`, B-14) must filter by `company_id` explicitly."""

    __tablename__ = "jobs"
    __table_args__ = (
        one_of("kind", JOB_KINDS, "kind_known"),
        one_of("status", JOB_STATUSES, "status_known"),
        CheckConstraint("jsonb_typeof(payload) = 'object'", name="payload_is_object"),
        CheckConstraint("max_attempts >= 1", name="max_attempts_positive"),
        CheckConstraint("attempts BETWEEN 0 AND max_attempts", name="attempts_range"),
        CheckConstraint("status <> 'FAILED' OR error_code IS NOT NULL", name="failure_has_code"),
        Index("ix_jobs_queued", "run_after", postgresql_where=text("status = 'QUEUED'")),
    )

    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"), index=True)
    kind: Mapped[str] = mapped_column(Text)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(Text, server_default="QUEUED")
    attempts: Mapped[int] = mapped_column(Integer, server_default="0")
    max_attempts: Mapped[int] = mapped_column(Integer, server_default="3")
    error_code: Mapped[str | None] = mapped_column(Text)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    run_after: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    locked_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))


class IdempotencyKey(TenantEntity, Base):
    """Replay store for approve/export/upload; no response yet = request in progress."""

    __tablename__ = "idempotency_keys"
    __table_args__ = (
        UniqueConstraint("company_id", "endpoint", "key"),
        CheckConstraint("length(key) BETWEEN 1 AND 255", name="key_length"),
        # same key + different body -> IDEMPOTENCY_KEY_REUSED
        CheckConstraint("request_hash ~ '^[0-9a-f]{64}$'", name="request_hash_hex"),
        CheckConstraint("(status_code IS NULL) = (response IS NULL)", name="response_complete"),
    )

    key: Mapped[str] = mapped_column(Text)
    endpoint: Mapped[str] = mapped_column(Text)
    request_hash: Mapped[str] = mapped_column(Text)
    status_code: Mapped[int | None] = mapped_column(Integer)
    response: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
