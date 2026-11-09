import datetime as dt
import uuid

from sqlalchemy import CheckConstraint, Date, DateTime, Index, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from payproof.domain.enums import TaskStatus
from payproof.repositories.models.validation import RULE_ID_CHECK
from payproof.repositories.orm import Base, TenantEntity, member_fk, one_of, same_tenant_fk


class ResolutionTask(TenantEntity, Base):
    """A fix routed to a person for one failing rule; only the system sets RESOLVED."""

    __tablename__ = "resolution_tasks"
    __table_args__ = (
        UniqueConstraint("company_id", "number"),
        same_tenant_fk("package_id", "invoice_packages"),
        member_fk("assignee_id"),  # may be an `assignee` member (ADR-0008)
        member_fk("created_by"),
        one_of("status", TaskStatus, "status_known"),
        CheckConstraint("number ~ '^T-[0-9]+$'", name="number_format"),
        CheckConstraint(RULE_ID_CHECK, name="rule_id_format"),
        CheckConstraint("length(step) > 0", name="step_present"),
        CheckConstraint(
            "(status = 'RESOLVED') = (resolved_at IS NOT NULL)", name="resolved_at_set"
        ),
        # B-19: one open task per rule and package; resolved or cancelled ones do not count
        Index(
            "uq_resolution_tasks_open_rule",
            "package_id",
            "rule_id",
            unique=True,
            postgresql_where=text("status <> 'RESOLVED' AND deleted_at IS NULL"),
        ),
    )

    number: Mapped[str] = mapped_column(Text)  # human-facing "T-124"
    package_id: Mapped[uuid.UUID] = mapped_column()
    rule_id: Mapped[str] = mapped_column(Text)
    assignee_id: Mapped[uuid.UUID] = mapped_column()
    created_by: Mapped[uuid.UUID] = mapped_column()
    step: Mapped[str] = mapped_column(Text)
    due_date: Mapped[dt.date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(Text, server_default="OPEN")
    comment: Mapped[str | None] = mapped_column(Text)
    resolved_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))  # cancel
