"""Load an adapter's input: the file plus the package's current stored extraction."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.extraction.base import DeliveryData, ExtractionInput, InvoiceData, LineData
from payproof.repositories import package_reads as reads
from payproof.repositories.models import (
    Customer,
    DeliveryNoteLine,
    DocumentVersion,
    ExtractedInvoiceLine,
    InvoicePackage,
)


async def _invoice(s: AsyncSession, pkg: InvoicePackage) -> InvoiceData | None:
    invoices, unread = await reads.invoices(s, [pkg.id])
    inv = invoices.get(pkg.id)
    if inv is None:
        return None
    rows = await s.scalars(
        select(ExtractedInvoiceLine).where(ExtractedInvoiceLine.extracted_invoice_id == inv.id)
    )
    return InvoiceData(
        po_ref=inv.po_ref,
        po_raw=inv.po_raw,
        currency=inv.currency,
        total=inv.total,
        lines=tuple(LineData(r.product_code, r.qty, r.unit, r.unit_price) for r in rows),
        unreadable=frozenset(p for v, p in unread if v == inv.document_version_id),
    )


async def _delivery(s: AsyncSession, pkg: InvoicePackage) -> DeliveryData | None:
    note = await reads.latest_delivery(s, pkg.id)
    if note is None:
        return None
    rows = await s.scalars(
        select(DeliveryNoteLine).where(DeliveryNoteLine.delivery_note_id == note.id)
    )
    return DeliveryData(
        note_number=note.note_number,
        po_ref=note.po_ref,
        customer_id=note.customer_id,
        signed=note.signed,
        delivery_date=note.delivery_date,
        lines=tuple(LineData(r.product_code, r.qty, None) for r in rows),
    )


async def extraction_input(
    s: AsyncSession, version: DocumentVersion, pkg: InvoicePackage, doc_type: str, data: bytes
) -> ExtractionInput:
    customer = await s.get_one(Customer, pkg.customer_id)
    return ExtractionInput(
        file_name=version.file_name,
        data=data,
        doc_type=doc_type,
        scanned=version.source_kind == "scan",
        customer_id=pkg.customer_id,
        customer=f"{customer.name}, VÖEN {customer.voen}",
        invoice=await _invoice(s, pkg),
        delivery=await _delivery(s, pkg),
    )
