import uuid
from typing import Any

from sqlalchemy import (
    ARRAY,
    Boolean,
    CheckConstraint,
    ForeignKeyConstraint,
    Integer,
    Text,
    UniqueConstraint,
    Uuid,
    false,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from payproof.domain.enums import CheckOutcome
from payproof.domain.rules.result import FixHint
from payproof.repositories.orm import Base, TenantEntity, one_of, same_tenant_fk, tenant_key

# mirrors `RuleId` in openapi.yaml (R-001..R-010)
RULE_ID_CHECK = "rule_id ~ '^R-0(0[1-9]|10)$'"


def _customer_fk(column: str, target: str) -> ForeignKeyConstraint:
    return ForeignKeyConstraint(
        [column, "customer_id", "company_id"],
        [f"{target}.id", f"{target}.customer_id", f"{target}.company_id"],
    )


class ValidationRun(TenantEntity, Base):
    """One deterministic rule-engine run for a package version and a rule set version."""

    __tablename__ = "validation_runs"
    __table_args__ = (
        tenant_key(),
        # approvals reference the exact (package, version, rule set) a run evaluated
        UniqueConstraint(
            "id",
            "package_id",
            "package_version",
            "requirement_set_id",
            "company_id",
            name="uq_validation_runs_run_key",  # generated name exceeds 63 characters
        ),
        # package and rule set must share the tenant *and* the customer
        _customer_fk("package_id", "invoice_packages"),
        _customer_fk("requirement_set_id", "requirement_sets"),
        CheckConstraint("package_version >= 1", name="package_version_positive"),
    )

    customer_id: Mapped[uuid.UUID] = mapped_column()
    package_id: Mapped[uuid.UUID] = mapped_column()
    package_version: Mapped[int] = mapped_column(Integer)
    requirement_set_id: Mapped[uuid.UUID] = mapped_column()
    engine_version: Mapped[str] = mapped_column(Text)


class CheckResult(TenantEntity, Base):
    __tablename__ = "check_results"
    __table_args__ = (
        UniqueConstraint("validation_run_id", "rule_id"),
        same_tenant_fk("validation_run_id", "validation_runs"),
        one_of("outcome", CheckOutcome, "outcome_known"),
        one_of("fix_hint", FixHint, "fix_hint_known"),
        CheckConstraint(RULE_ID_CHECK, name="rule_id_format"),
        CheckConstraint("jsonb_typeof(data) = 'object'", name="data_is_object"),
    )

    validation_run_id: Mapped[uuid.UUID] = mapped_column()
    rule_id: Mapped[str] = mapped_column(Text)
    outcome: Mapped[str] = mapped_column(Text)
    cascade: Mapped[bool] = mapped_column(Boolean, server_default=false())
    message: Mapped[str] = mapped_column(Text)
    fix_hint: Mapped[str | None] = mapped_column(Text)  # which fix the UI offers
    data: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    # shortcut: no FK on array items; B-17 writes only evidence ids of the run's own document
    # versions. Upgrade to a check_result_evidence join table if results are ever written elsewhere.
    evidence_ids: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(Uuid), server_default=text("'{}'::uuid[]")
    )
