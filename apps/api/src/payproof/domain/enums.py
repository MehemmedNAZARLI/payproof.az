"""Domain vocabularies; values mirror packages/contracts/openapi.yaml (checked by tests)."""

from enum import StrEnum


class PackageStatus(StrEnum):
    """Derived from the latest run, approvals and exports — never stored as truth. No PAID."""

    PROCESSING = "PROCESSING"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    NEEDS_FIX = "NEEDS_FIX"
    READY_FOR_APPROVAL = "READY_FOR_APPROVAL"
    APPROVED_READY = "APPROVED_READY"
    EXPORTED = "EXPORTED"


class CheckOutcome(StrEnum):
    """UNKNOWN is never PASS and blocks the package."""

    PASS = "PASS"  # noqa: S105 — a rule outcome, not a password
    FAIL = "FAIL"
    UNKNOWN = "UNKNOWN"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class TaskStatus(StrEnum):
    """RESOLVED is set only by the system, when the task's rule passes."""

    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    SUBMITTED_FOR_RECHECK = "SUBMITTED_FOR_RECHECK"
    RESOLVED = "RESOLVED"


class DocumentStatus(StrEnum):
    """Status of one document version; FAILED is a technical error, not a business FAIL."""

    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"
    EXTRACTED = "EXTRACTED"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    FAILED = "FAILED"


class Role(StrEnum):
    OPERATOR = "operator"
    APPROVER = "approver"
    READONLY = "readonly"
    ADMIN = "admin"
    ASSIGNEE = "assignee"  # task assignee only: cannot sign in, no permissions (ADR-0008)


class Currency(StrEnum):
    """Amounts in different currencies are never summed or converted."""

    AZN = "AZN"
    USD = "USD"
