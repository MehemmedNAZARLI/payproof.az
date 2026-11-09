import datetime as dt
import uuid
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, Index, Integer, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from payproof.repositories.orm import Base, IdMixin, TenantMixin, member_fk, same_tenant_fk


class AuditEvent(IdMixin, TenantMixin, Base):
    """Append-only (DB trigger rejects UPDATE/DELETE). Never holds document text."""

    __tablename__ = "audit_events"
    __table_args__ = (
        member_fk("actor_id"),
        same_tenant_fk("package_id", "invoice_packages"),
        CheckConstraint("action ~ '^[a-z_]+\\.[a-z_]+$'", name="action_format"),
        CheckConstraint("jsonb_typeof(detail) = 'object'", name="detail_is_object"),
        CheckConstraint("length(message) > 0", name="message_present"),
        Index("ix_audit_events_package_id", "package_id"),  # package audit tab
    )

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column()  # NULL = system
    action: Mapped[str] = mapped_column(Text)  # "package.approved"
    message: Mapped[str] = mapped_column(Text)  # Azerbaijani summary for the UI, no document text
    object_type: Mapped[str] = mapped_column(Text)
    object_id: Mapped[uuid.UUID | None] = mapped_column()
    package_id: Mapped[uuid.UUID | None] = mapped_column()
    package_version: Mapped[int | None] = mapped_column(Integer)
    detail: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    correlation_id: Mapped[str | None] = mapped_column(Text)
