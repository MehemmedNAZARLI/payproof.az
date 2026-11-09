"""Bulk reads behind the package list/detail/dashboard: one query per concern, keyed by
package id, so loading N packages costs a fixed number of queries (no N+1)."""

import uuid
from collections.abc import Iterable

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.domain.enums import CheckOutcome, Role
from payproof.domain.rules.result import CheckResult, FixHint
from payproof.repositories.base import TENANT_KEY
from payproof.repositories.models import (
    ApprovalRecord,
    DeliveryNote,
    Document,
    DocumentVersion,
    ExportRecord,
    ExtractedField,
    ExtractedInvoice,
    InvoicePackage,
    Membership,
    Order,
    RequirementSet,
    User,
    ValidationRun,
)
from payproof.repositories.models import CheckResult as CheckRow

Ids = Iterable[uuid.UUID]


def latest[T](rows: Iterable[tuple[uuid.UUID, int, T]]) -> dict[uuid.UUID, T]:
    """Value of the highest version per key."""
    best: dict[uuid.UUID, tuple[int, T]] = {}
    for key, version, value in rows:
        if key not in best or version > best[key][0]:
            best[key] = (version, value)
    return {k: v for k, (_, v) in best.items()}


async def owners(session: AsyncSession, user_ids: Ids) -> dict[uuid.UUID, tuple[User, Role]]:
    """Users with their role in the session's company (inactive members included)."""
    q = (
        select(User, Membership.role)
        .join(Membership, Membership.user_id == User.id)
        .where(User.id.in_(list(user_ids)), Membership.company_id == session.info[TENANT_KEY])
    )
    return {user.id: (user, Role(role)) for user, role in (await session.execute(q)).all()}


async def invoices(
    session: AsyncSession, ids: Ids
) -> tuple[dict[uuid.UUID, ExtractedInvoice], set[tuple[uuid.UUID, str]]]:
    """Extraction of each package's latest extracted invoice version, and the
    (document_version_id, field_path) pairs still waiting for review."""
    q = (
        select(Document.package_id, DocumentVersion.version_no, ExtractedInvoice)
        .join(DocumentVersion, DocumentVersion.document_id == Document.id)
        .join(ExtractedInvoice, ExtractedInvoice.document_version_id == DocumentVersion.id)
        .where(Document.type == "invoice", Document.package_id.in_(list(ids)))
    )
    found = latest((pid, no, inv) for pid, no, inv in (await session.execute(q)).all())
    fields = select(ExtractedField.document_version_id, ExtractedField.field_path).where(
        ExtractedField.review_status == "REVIEW_REQUIRED",
        ExtractedField.document_version_id.in_([i.document_version_id for i in found.values()]),
    )
    return found, {(vid, path) for vid, path in (await session.execute(fields)).all()}


async def latest_delivery(session: AsyncSession, package_id: uuid.UUID) -> DeliveryNote | None:
    """Delivery note of the package's newest extracted delivery version."""
    return await session.scalar(
        select(DeliveryNote)
        .join(DocumentVersion, DocumentVersion.id == DeliveryNote.document_version_id)
        .join(Document, Document.id == DocumentVersion.document_id)
        .where(Document.package_id == package_id)
        .order_by(DocumentVersion.version_no.desc())
        .limit(1)
    )


async def delivery_numbers(session: AsyncSession, ids: Ids) -> dict[uuid.UUID, str | None]:
    q = (
        select(Document.package_id, DocumentVersion.version_no, DeliveryNote.note_number)
        .join(DocumentVersion, DocumentVersion.document_id == Document.id)
        .join(DeliveryNote, DeliveryNote.document_version_id == DocumentVersion.id)
        .where(Document.type == "delivery", Document.package_id.in_(list(ids)))
    )
    return latest((pid, no, note) for pid, no, note in (await session.execute(q)).all())


async def order_numbers(session: AsyncSession, order_ids: Ids) -> dict[uuid.UUID, str]:
    q = select(Order.id, Order.po_number).where(Order.id.in_(list(order_ids)))
    return {oid: po for oid, po in (await session.execute(q)).all()}


async def current_runs(
    session: AsyncSession, ids: Ids
) -> tuple[dict[uuid.UUID, ValidationRun], dict[uuid.UUID, tuple[CheckResult, ...]]]:
    """Latest run of each package's *current* version, with its results in rule order."""
    current = and_(
        InvoicePackage.id == ValidationRun.package_id,
        InvoicePackage.version == ValidationRun.package_version,
    )
    q = (
        select(ValidationRun)
        .join(InvoicePackage, current)
        .where(ValidationRun.package_id.in_(list(ids)))
        .order_by(ValidationRun.created_at)
    )
    runs = {r.package_id: r for r in (await session.scalars(q)).all()}  # later wins
    rows = await session.scalars(
        select(CheckRow)
        .where(CheckRow.validation_run_id.in_([r.id for r in runs.values()]))
        .order_by(CheckRow.rule_id)
    )
    checks: dict[uuid.UUID, list[CheckResult]] = {}
    for c in rows.all():
        checks.setdefault(c.validation_run_id, []).append(
            CheckResult(
                c.rule_id,
                CheckOutcome(c.outcome),
                c.message,
                cascade=c.cascade,
                fix_hint=FixHint(c.fix_hint) if c.fix_hint else None,
                data=c.data,
            )
        )
    return runs, {k: tuple(v) for k, v in checks.items()}


async def rule_sets_in_force(
    session: AsyncSession, packages: list[InvoicePackage]
) -> dict[uuid.UUID, uuid.UUID]:
    """Rule set of the current version's export, else the customer's latest (ADR-0009)."""
    q = select(RequirementSet.customer_id, RequirementSet.version, RequirementSet.id).where(
        RequirementSet.customer_id.in_({p.customer_id for p in packages})
    )
    newest = latest((cid, version, rs) for cid, version, rs in (await session.execute(q)).all())
    exported = (
        select(
            ExportRecord.package_id, ExportRecord.package_version, ApprovalRecord.requirement_set_id
        )
        .join(ApprovalRecord, ApprovalRecord.id == ExportRecord.approval_id)
        .where(ExportRecord.package_id.in_([p.id for p in packages]))
    )
    at_export = {(pid, pv): rs for pid, pv, rs in (await session.execute(exported)).all()}
    return {
        p.id: at_export.get((p.id, p.version), newest[p.customer_id])
        for p in packages
        if p.customer_id in newest
    }


async def approved_and_exported(
    session: AsyncSession, packages: list[InvoicePackage], rule_sets: dict[uuid.UUID, uuid.UUID]
) -> tuple[set[uuid.UUID], set[uuid.UUID]]:
    """Packages whose current version has a valid approval under the rule set in force,
    and packages whose current version was exported."""
    by_id = {p.id: p for p in packages}
    approvals = await session.execute(
        select(
            ApprovalRecord.package_id,
            ApprovalRecord.package_version,
            ApprovalRecord.requirement_set_id,
        ).where(ApprovalRecord.valid.is_(True), ApprovalRecord.package_id.in_(by_id))
    )
    approved = {
        pid
        for pid, pv, rs in approvals.all()
        if pv == by_id[pid].version and rs == rule_sets.get(pid)
    }
    exports = await session.execute(
        select(ExportRecord.package_id, ExportRecord.package_version).where(
            ExportRecord.package_id.in_(by_id)
        )
    )
    exported = {pid for pid, pv in exports.all() if pv == by_id[pid].version}
    return approved, exported
