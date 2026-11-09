"""Order link: confirmed by a person (an AI suggestion never links on its own), or linked
automatically when the invoice carries the exact PO of the same customer."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.errors import Conflict, InvalidInput, NotFound, PackageNotReady
from payproof.repositories import package_reads as reads
from payproof.repositories.models import InvoicePackage, Order
from payproof.services import matching
from payproof.services.audit import record
from payproof.services.validation import revalidate
from payproof.services.versioning import bump

REASON = "sifariş əlaqəsi dəyişdi"


async def locked_package(session: AsyncSession, package_id: uuid.UUID) -> InvoicePackage:
    pkg = await session.scalar(
        select(InvoicePackage)
        .where(InvoicePackage.id == package_id, InvoicePackage.deleted_at.is_(None))
        .with_for_update()  # changes to one package run one after another
    )
    if pkg is None:
        raise NotFound  # also another company's package
    return pkg


async def after_extraction(session: AsyncSession, pkg: InvoicePackage) -> None:
    """New fields are in: link the exact PO if there is one, then re-validate. Part of the
    upload that already bumped the version, so no second bump here."""
    if pkg.order_id is None:
        invoices, _ = await reads.invoices(session, [pkg.id])
        inv = invoices.get(pkg.id)
        if order := await matching.exact_order(session, pkg, inv.po_ref if inv else None):
            pkg.order_id, pkg.link_method = order.id, "exact_id"
            await record(
                session,
                actor_id=None,
                action="link.exact_match",
                message=f"{order.po_number} · üsul: dəqiq PO uyğunluğu · paket v{pkg.version}",
                object_type="order_link",
                object_id=order.id,
                package=pkg,
            )
    await revalidate(session, pkg)


async def confirm_link(
    session: AsyncSession,
    *,
    actor_id: uuid.UUID,
    package_id: uuid.UUID,
    order_id: uuid.UUID,
    expected_version: int,
) -> None:
    """Write → version bump (approval invalidated) → audit → re-validation, one transaction.
    Confirming the order that is already linked changes nothing (a retry is safe)."""
    pkg = await locked_package(session, package_id)
    if pkg.order_id == order_id:
        return
    if pkg.processing:
        raise PackageNotReady(details={"status": "PROCESSING"})
    if expected_version != pkg.version:
        raise Conflict(
            f"Paket v{pkg.version}-ə yenilənib; səhifəni yeniləyin.",
            {"current_version": pkg.version, "expected_version": expected_version},
        )
    order = await session.scalar(select(Order).where(Order.id == order_id))
    if order is None or order.customer_id != pkg.customer_id:
        raise InvalidInput(
            "Bu sifariş paketin müştərisinə aid deyil.", {"fields": {"order_id": "naməlum"}}
        )
    pkg.order_id, pkg.link_method, pkg.link_confirmed_by = order.id, "human", actor_id
    await bump(session, pkg, REASON)
    await record(
        session,
        actor_id=actor_id,
        action="link.confirmed",
        message=f"{order.po_number} · üsul: insan təsdiqi · paket v{pkg.version}",
        object_type="order_link",
        object_id=order.id,
        package=pkg,
    )
    await revalidate(session, pkg)
    await session.commit()
