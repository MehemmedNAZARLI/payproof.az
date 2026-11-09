"""HTTP shape of GET /v1/packages/{id} (openapi: PackageDetail and its parts)."""

import datetime as dt
import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from payproof.domain.enums import CheckOutcome, Currency, DocumentStatus, PackageStatus, TaskStatus
from payproof.schemas.auth import UserRef
from payproof.schemas.packages import Blocker, CustomerRef, Money, PackageRef


class RequirementSet(BaseModel):
    id: uuid.UUID
    version: int
    require_po: bool
    require_delivery: bool
    require_signature: bool
    tolerance: str  # "0.01"
    effective_from: dt.date
    approved_by: UserRef
    reason: str
    created_at: dt.datetime


class MatchCandidate(BaseModel):
    order_id: uuid.UUID
    po_number: str
    order_date: dt.date
    total: Money
    reason: str


class OrderLink(BaseModel):
    confirmed: bool
    order_id: uuid.UUID | None
    order_po: str | None
    method: Literal["exact_id", "human"] | None
    confirmed_by: UserRef | None
    candidates: list[MatchCandidate]


class DocumentVersion(BaseModel):
    id: uuid.UUID
    version_no: int
    file_name: str
    source_kind: Literal["pdf", "scan", "spreadsheet"]
    status: DocumentStatus
    sha256: str
    uploaded_by: UserRef
    uploaded_at: dt.datetime
    package_version_at_upload: int


class Document(BaseModel):
    id: uuid.UUID
    type: Literal["invoice", "order", "delivery"]
    current: DocumentVersion
    history: list[DocumentVersion]  # newest first


class Evidence(BaseModel):
    document_version_id: uuid.UUID
    page: int
    quote: str
    bbox: list[float] | None


class ExtractedField(BaseModel):
    id: uuid.UUID
    document_version_id: uuid.UUID
    field_path: str
    label: str
    raw_value: str | None
    value: str | None
    review_status: Literal["EXTRACTED", "REVIEW_REQUIRED", "CORRECTED"]
    evidence: Evidence | None


class ComparisonCell(BaseModel):
    value: str | None
    currency: Currency | None = None
    state: Literal["ok", "mismatch", "unknown", "empty"]
    field_id: uuid.UUID | None = None
    evidence: Evidence | None = None


class ComparisonRow(BaseModel):
    key: str
    group: str | None
    label: str
    invoice: ComparisonCell
    order: ComparisonCell
    delivery: ComparisonCell


class Comparison(BaseModel):
    rows: list[ComparisonRow]


class CheckResult(BaseModel):
    rule_id: str
    title: str
    outcome: CheckOutcome
    cascade: bool
    message: str
    evidence: list[Evidence]
    fix_hint: str | None
    data: dict[str, Any]


class CheckSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    pass_: int = Field(alias="pass")  # `pass` is a Python keyword
    fail: int
    unknown: int
    not_applicable: int
    blocking: list[Blocker]


class ApprovalRecord(BaseModel):
    id: uuid.UUID
    package_version: int
    requirement_set_version: int
    approver: UserRef
    approved_at: dt.datetime
    valid: bool
    invalidated_reason: str | None
    invalidated_at: dt.datetime | None


class ExportFile(BaseModel):
    document_version_id: uuid.UUID
    type: Literal["invoice", "order", "delivery"]
    file_name: str


class ExportRecord(BaseModel):
    id: uuid.UUID
    package_version: int
    requirement_set_version: int
    created_by: UserRef
    created_at: dt.datetime
    files: list[ExportFile]


class Task(BaseModel):
    id: uuid.UUID
    number: str
    package: PackageRef
    rule_id: str
    assignee: UserRef
    step: str
    due_date: dt.date
    status: TaskStatus
    comment: str | None
    created_at: dt.datetime
    created_by: UserRef
    resolved_at: dt.datetime | None


class PackagePermissions(BaseModel):
    can_edit: bool
    can_manage_tasks: bool
    can_approve: bool
    can_export: bool
    can_delete: bool


class PackageDetail(BaseModel):
    id: uuid.UUID
    invoice_number: str | None
    version: int
    status: PackageStatus
    processing: bool
    customer: CustomerRef
    invoice_date: dt.date | None
    owner: UserRef
    created_at: dt.datetime
    updated_at: dt.datetime
    total: Money | None
    requirement_set: RequirementSet
    link: OrderLink
    documents: list[Document]
    fields: list[ExtractedField]
    comparison: Comparison
    checks: list[CheckResult]
    summary: CheckSummary
    current_approval: ApprovalRecord | None
    approvals: list[ApprovalRecord]
    exports: list[ExportRecord]
    tasks: list[Task]
    permissions: PackagePermissions
