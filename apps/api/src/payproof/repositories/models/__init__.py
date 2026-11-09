"""All ORM models; importing this package registers every table on `Base.metadata`."""

# the tenant guard is a Session event: anyone who can query models must also get the guard
from payproof.repositories import base as _tenant_guard  # noqa: F401
from payproof.repositories.models.approvals import ApprovalRecord, ExportRecord
from payproof.repositories.models.audit import AuditEvent
from payproof.repositories.models.customers import Customer, RequirementSet
from payproof.repositories.models.documents import Document, DocumentVersion
from payproof.repositories.models.extraction import (
    DeliveryNote,
    DeliveryNoteLine,
    ExtractedInvoice,
    ExtractedInvoiceLine,
)
from payproof.repositories.models.fields import EvidenceRef, ExtractedField
from payproof.repositories.models.identity import Company, Membership, User
from payproof.repositories.models.orders import Order, OrderLine
from payproof.repositories.models.packages import InvoicePackage
from payproof.repositories.models.system import IdempotencyKey, Job, Notification
from payproof.repositories.models.tasks import ResolutionTask
from payproof.repositories.models.validation import CheckResult, ValidationRun

__all__ = [
    "ApprovalRecord",
    "AuditEvent",
    "CheckResult",
    "Company",
    "Customer",
    "DeliveryNote",
    "DeliveryNoteLine",
    "Document",
    "DocumentVersion",
    "EvidenceRef",
    "ExportRecord",
    "ExtractedField",
    "ExtractedInvoice",
    "ExtractedInvoiceLine",
    "IdempotencyKey",
    "InvoicePackage",
    "Job",
    "Membership",
    "Notification",
    "Order",
    "OrderLine",
    "RequirementSet",
    "ResolutionTask",
    "User",
    "ValidationRun",
]
