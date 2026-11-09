"""Serializers for parts of the package detail (documents, fields, approvals, tasks)."""

import uuid
from collections.abc import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from payproof.domain.rules.paths import INVOICE_PO
from payproof.repositories import detail_reads as dr
from payproof.repositories import package_reads as reads
from payproof.repositories.models import (
    ApprovalRecord,
    Document,
    DocumentVersion,
    ExtractedField,
    ResolutionTask,
)
from payproof.schemas import detail as d
from payproof.schemas.auth import UserRef
from payproof.schemas.packages import PackageRef
from payproof.services.package_query import PackageState

Ref = Callable[[uuid.UUID], UserRef]


def _label(path: str) -> str:
    if path == INVOICE_PO:
        return "Sifariş № (PO)"
    code = path.split("[", 1)[1].split("]", 1)[0]
    return f"{code} miqdarı" if path.endswith(".qty") else f"{code} vahid qiyməti"


def _rank(path: str, line_order: dict[str, int]) -> tuple[int, int, str]:
    """Mock `fieldPaths` order: PO first, then qty and unit price per invoice line."""
    if path == INVOICE_PO:
        return (0, 0, path)
    code = path.split("[", 1)[1].split("]", 1)[0] if "[" in path else ""
    return (1, line_order.get(code, 999), path)


async def fields(
    session: AsyncSession, st: PackageState
) -> tuple[list[d.ExtractedField], dict[str, uuid.UUID]]:
    """Editable fields of the current invoice version, and their ids by field path."""
    invoices, _ = await reads.invoices(session, [st.package.id])
    inv = invoices.get(st.package.id)
    if inv is None:
        return [], {}
    rows: list[ExtractedField] = await dr.fields(session, inv.document_version_id)
    line_order = {
        f.field_path.split("[", 1)[1].split("]")[0]: i
        for i, f in enumerate(rows)
        if "[" in f.field_path
    }
    rows.sort(key=lambda f: _rank(f.field_path, line_order))
    out = [
        d.ExtractedField(
            id=f.id,
            document_version_id=f.document_version_id,
            field_path=f.field_path,
            label=_label(f.field_path),
            raw_value=f.raw_value,
            value=f.normalized_value,
            review_status=f.review_status,
            evidence=None,  # shortcut: evidence_refs arrive with real extraction (B-15)
        )
        for f in rows
    ]
    return out, {f.field_path: f.id for f in rows}


def document(doc: Document, versions: list[DocumentVersion], ref: Ref) -> d.Document:
    """`versions` newest first: the first is current, the rest is history."""
    out = [
        d.DocumentVersion(
            id=v.id,
            version_no=v.version_no,
            file_name=v.file_name,
            source_kind=v.source_kind,
            status=v.status,
            sha256=v.sha256,
            uploaded_by=ref(v.uploaded_by),
            uploaded_at=v.created_at,
            package_version_at_upload=v.package_version_at_upload,
        )
        for v in versions
    ]
    return d.Document(id=doc.id, type=doc.type, current=out[0], history=out[1:])


def approval(a: ApprovalRecord, rs_versions: dict[uuid.UUID, int], ref: Ref) -> d.ApprovalRecord:
    return d.ApprovalRecord(
        id=a.id,
        package_version=a.package_version,
        requirement_set_version=rs_versions[a.requirement_set_id],
        approver=ref(a.approver_id),
        approved_at=a.created_at,
        valid=a.valid,
        invalidated_reason=a.invalidated_reason,
        invalidated_at=a.invalidated_at,
    )


def task(t: ResolutionTask, invoice_number: str, ref: Ref) -> d.Task:
    return d.Task(
        id=t.id,
        number=t.number,
        package=PackageRef(id=t.package_id, invoice_number=invoice_number),
        rule_id=t.rule_id,
        assignee=ref(t.assignee_id),
        step=t.step,
        due_date=t.due_date,
        status=t.status,
        comment=t.comment,
        created_at=t.created_at,
        created_by=ref(t.created_by),
        resolved_at=t.resolved_at,
    )
