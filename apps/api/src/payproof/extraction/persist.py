"""Store a validated extraction result for one document version: invoice/delivery rows, the
editable fields, and the evidence (page + quote) behind each critical value."""

from sqlalchemy.ext.asyncio import AsyncSession

from payproof.domain.enums import DocumentStatus
from payproof.domain.rules.paths import INVOICE_PO, line
from payproof.extraction.base import DeliveryData, ExtractionResult, InvoiceData
from payproof.repositories.models import (
    DeliveryNote,
    DeliveryNoteLine,
    DocumentVersion,
    EvidenceRef,
    ExtractedField,
    ExtractedInvoice,
    ExtractedInvoiceLine,
    InvoicePackage,
)


def _text(value: object) -> str | None:
    return None if value is None else str(value)


async def _invoice(
    s: AsyncSession, v: DocumentVersion, pkg: InvoicePackage, inv: InvoiceData
) -> None:
    head = ExtractedInvoice(
        company_id=v.company_id,
        document_version_id=v.id,
        po_ref=inv.po_ref,
        po_raw=inv.po_raw,
        total=inv.total,
        currency=inv.currency,
    )
    s.add(head)
    await s.flush()
    s.add_all(
        ExtractedInvoiceLine(
            company_id=v.company_id,
            extracted_invoice_id=head.id,
            product_code=li.product_code,
            qty=li.qty,
            unit=li.unit,
            unit_price=li.unit_price,
        )
        for li in inv.lines
    )
    unread = INVOICE_PO in inv.unreadable
    values = [(INVOICE_PO, inv.po_raw if unread else inv.po_ref, inv.po_ref)]
    for li in inv.lines:
        values.append((line("invoice", li.product_code, "qty"), _text(li.qty), _text(li.qty)))
        price = _text(li.unit_price)
        values.append((line("invoice", li.product_code, "unit_price"), price, price))
    s.add_all(
        ExtractedField(
            company_id=v.company_id,
            document_version_id=v.id,
            field_path=path,
            raw_value=raw,
            normalized_value=value,
            review_status="REVIEW_REQUIRED" if path in inv.unreadable else "EXTRACTED",
        )
        for path, raw, value in values
    )
    if inv.currency:
        pkg.currency = inv.currency  # the invoice is the source of the package currency


async def _delivery(s: AsyncSession, v: DocumentVersion, d: DeliveryData) -> None:
    note = DeliveryNote(
        company_id=v.company_id,
        document_version_id=v.id,
        note_number=d.note_number,
        po_ref=d.po_ref,
        customer_id=d.customer_id,
        signed=d.signed,
        delivery_date=d.delivery_date,
    )
    s.add(note)
    await s.flush()
    s.add_all(
        DeliveryNoteLine(
            company_id=v.company_id,
            delivery_note_id=note.id,
            product_code=li.product_code,
            qty=li.qty,
        )
        for li in d.lines
    )


async def store(
    s: AsyncSession, v: DocumentVersion, pkg: InvoicePackage, r: ExtractionResult
) -> DocumentStatus:
    """Call after `validate()`. REVIEW_REQUIRED when a critical field could not be read."""
    if r.invoice:
        await _invoice(s, v, pkg, r.invoice)
    if r.delivery:
        await _delivery(s, v, r.delivery)
    s.add_all(
        EvidenceRef(
            company_id=v.company_id,
            document_version_id=v.id,
            field_path=e.field_path,
            page=e.page,
            quote=e.quote,
            bbox=list(e.bbox) if e.bbox else None,
        )
        for e in r.evidence
    )
    await s.flush()
    return DocumentStatus.REVIEW_REQUIRED if r.needs_review else DocumentStatus.EXTRACTED
