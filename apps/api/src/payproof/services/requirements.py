"""Customer requirement sets: immutable versions, approver only. A new version re-validates
every package of the customer whose current version is not exported — through a version bump,
so the current approval is invalidated (kept in the audit) and the approver told (ADR-0009)."""

import datetime as dt
import uuid
from dataclasses import dataclass, replace
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.errors import Conflict, InvalidInput, NotFound
from payproof.repositories.models import Customer, ExportRecord, InvoicePackage, RequirementSet
from payproof.services import requirement_config
from payproof.services.audit import record
from payproof.services.validation import revalidate
from payproof.services.versioning import bump


@dataclass(frozen=True)
class NewRules:
    require_po: bool
    require_delivery: bool
    require_signature: bool
    tolerance: Decimal
    effective_from: dt.date
    reason: str
    expected_version: int
    # ADR-0011: documents + checks make a configured set; both None = legacy flags only
    documents: list[dict[str, Any]] | None = None
    checks: list[dict[str, Any]] | None = None
    output: dict[str, Any] | None = None


async def latest(session: AsyncSession, customer_id: uuid.UUID) -> RequirementSet | None:
    return await session.scalar(
        select(RequirementSet)
        .where(RequirementSet.customer_id == customer_id)
        .order_by(RequirementSet.version.desc())
        .limit(1)
    )


def _same(rs: RequirementSet, new: NewRules) -> bool:
    old = (rs.require_po, rs.require_delivery, rs.require_signature, rs.tolerance)
    old_config = (rs.documents, rs.checks, rs.output)
    return old == (new.require_po, new.require_delivery, new.require_signature, new.tolerance) and (
        old_config == (new.documents, new.checks, new.output)
    )


async def create_rule_set(
    session: AsyncSession, *, actor_id: uuid.UUID, customer_id: uuid.UUID, new: NewRules
) -> RequirementSet:
    customer = await session.scalar(
        select(Customer).where(Customer.id == customer_id).with_for_update()
    )  # one new version at a time per customer
    if customer is None:
        raise NotFound
    current = await latest(session, customer.id)
    version = current.version if current else 0
    if new.expected_version != version:
        raise Conflict(
            f"Qayda dəsti v{version}-ə yenilənib; səhifəni yeniləyin.",
            {"current_version": version, "expected_version": new.expected_version},
        )
    if (new.documents is None) != (new.checks is None):
        raise InvalidInput(
            "documents və checks birlikdə göndərilir.", {"fields": {"documents": "checks ilə"}}
        )
    if new.checks is None and new.output is None and current and current.checks is not None:
        # a flags-only edit (e.g. the web rules screen) keeps the configuration in force
        new = replace(new, documents=current.documents, checks=current.checks,
                      output=current.output)  # fmt: skip
    if new.output is not None and new.checks is None:
        raise InvalidInput("Çıxış şablonu yalnız konfiqurasiya olunan dəstdə ola bilər.",
                           {"fields": {"output": "documents/checks tələb olunur"}})  # fmt: skip
    if new.documents is not None and new.checks is not None:
        await requirement_config.validate(
            session, customer.id, new.documents, new.checks, new.output
        )
    if current and _same(current, new):
        raise InvalidInput("Qaydalarda dəyişiklik yoxdur.", {"fields": {"rules": "dəyişməyib"}})
    rs = RequirementSet(
        company_id=customer.company_id, customer_id=customer.id, version=version + 1,
        require_po=new.require_po, require_delivery=new.require_delivery,
        require_signature=new.require_signature, tolerance=new.tolerance,
        effective_from=new.effective_from, approved_by=actor_id, reason=new.reason.strip(),
        documents=new.documents, checks=new.checks, output=new.output,
    )  # fmt: skip
    session.add(rs)
    await session.flush()
    await record(
        session, actor_id=actor_id, action="requirements.updated",
        message=f"{customer.name}: qayda dəsti v{rs.version} — {rs.reason}",
        object_type="requirement_set", object_id=rs.id,
    )  # fmt: skip
    exported = select(ExportRecord.id).where(
        ExportRecord.package_id == InvoicePackage.id,
        ExportRecord.package_version == InvoicePackage.version,
    )
    packages = await session.scalars(
        select(InvoicePackage)
        .where(
            InvoicePackage.customer_id == customer.id,
            InvoicePackage.deleted_at.is_(None),
            InvoicePackage.processing.is_(False),
            ~exported.exists(),  # an exported version stays under the rules it was exported with
        )
        .with_for_update()
    )
    for pkg in packages.all():
        await bump(session, pkg, f"qayda dəsti v{rs.version} qüvvəyə mindi")
        await revalidate(session, pkg)
    await session.commit()
    return rs
