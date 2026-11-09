"""Package state for the read APIs. Status comes from the current version's latest validation
run (B-17 writes runs; the seed writes one per package) plus approvals and exports — it is
derived, never stored."""

import uuid
from collections.abc import Collection
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.domain.enums import Currency, PackageStatus, Role
from payproof.domain.money import Money
from payproof.domain.rules.engine import primary_blockers
from payproof.domain.rules.paths import INVOICE_PO
from payproof.domain.rules.result import CheckResult
from payproof.domain.status import derive_status
from payproof.repositories import package_reads as reads
from payproof.repositories.models import (
    Customer,
    ExtractedInvoice,
    InvoicePackage,
    User,
    ValidationRun,
)


@dataclass(frozen=True)
class PackageState:
    package: InvoicePackage
    customer_name: str
    owner: User
    owner_role: Role
    total: Money | None  # None until the invoice is extracted
    po_ref: str | None
    po_unreadable: bool
    delivery_no: str | None
    order_po: str | None
    run: ValidationRun | None
    checks: tuple[CheckResult, ...]
    status: PackageStatus
    blockers: tuple[CheckResult, ...]  # primary (non-cascade) FAIL / UNKNOWN
    rule_set_id: uuid.UUID | None  # rule set in force (rules-engine.md "Rule version")


async def load_states(
    session: AsyncSession, package_ids: Collection[uuid.UUID] | None = None
) -> list[PackageState]:
    """Live (not deleted) packages of the session's tenant, optionally only `package_ids`,
    in a fixed number of queries."""
    q = (
        select(InvoicePackage, Customer.name)
        .join(Customer, Customer.id == InvoicePackage.customer_id)
        .where(InvoicePackage.deleted_at.is_(None))
    )
    if package_ids is not None:
        q = q.where(InvoicePackage.id.in_(package_ids))
    rows = [(p, name) for p, name in (await session.execute(q)).all()]
    packages = [p for p, _ in rows]
    ids = [p.id for p in packages]
    owners = await reads.owners(session, {p.owner_id for p in packages})
    invoices, unread = await reads.invoices(session, ids)
    notes = await reads.delivery_numbers(session, ids)
    orders = await reads.order_numbers(session, {p.order_id for p in packages if p.order_id})
    runs, checks = await reads.current_runs(session, ids)
    rule_sets = await reads.rule_sets_in_force(session, packages)
    approved, exported = await reads.approved_and_exported(session, packages, rule_sets)
    states = []
    for p, customer_name in rows:
        inv, run = invoices.get(p.id), runs.get(p.id)
        found = checks.get(run.id, ()) if run else ()
        user, role = owners[p.owner_id]
        states.append(
            PackageState(
                package=p,
                customer_name=customer_name,
                owner=user,
                owner_role=role,
                total=_total(inv, p.currency),
                po_ref=inv.po_ref if inv else None,
                po_unreadable=inv is not None and (inv.document_version_id, INVOICE_PO) in unread,
                delivery_no=notes.get(p.id),
                order_po=orders.get(p.order_id) if p.order_id else None,
                run=run,
                checks=found,
                status=derive_status(
                    processing=p.processing,
                    link_confirmed=p.order_id is not None,
                    checks=found,
                    approved=p.id in approved,
                    exported=p.id in exported,
                ),
                blockers=() if p.processing else primary_blockers(found),
                rule_set_id=rule_sets.get(p.id),
            )
        )
    return states


def _total(inv: ExtractedInvoice | None, currency: str | None) -> Money | None:
    if inv is None or inv.total is None or currency is None:
        return None
    return Money(inv.total, Currency(currency))
