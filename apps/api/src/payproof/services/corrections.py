"""Manual correction of an extracted field, read off the source by a person. The document
itself does not change: the raw value stays, the corrected one is used by the rules."""

import re
import uuid
from decimal import Decimal, InvalidOperation

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.errors import Conflict, InvalidInput, NotFound, PackageNotReady
from payproof.domain.enums import DocumentStatus
from payproof.domain.rules.paths import INVOICE_PO
from payproof.repositories import package_reads as reads
from payproof.repositories.models import (
    Document,
    DocumentVersion,
    ExtractedField,
    ExtractedInvoiceLine,
)
from payproof.services.audit import record
from payproof.services.linking import locked_package
from payproof.services.validation import revalidate
from payproof.services.versioning import bump

MIN_REASON = 5
_PO = re.compile(r"^PO-\d+$")
_LINE = re.compile(r"^invoice\.lines\[([^\]]+)\]\.(qty|unit_price)$")


def _bad(message: str, field: str = "value") -> InvalidInput:
    return InvalidInput(message, {"fields": {field: message}})


def _amount(value: str, places: int, message: str) -> Decimal:
    try:
        number = Decimal(value)
    except InvalidOperation:
        raise _bad(message) from None
    if not number.is_finite() or number <= 0 or number != round(number, places):
        raise _bad(message)
    return number


async def correct_field(
    session: AsyncSession,
    *,
    actor_id: uuid.UUID,
    field_id: uuid.UUID,
    value: str,
    reason: str,
    expected_version: int,
) -> uuid.UUID:
    """Returns the package id. One transaction: field + invoice row, version bump, audit with
    old/new value and reason, re-validation."""
    field = await session.scalar(select(ExtractedField).where(ExtractedField.id == field_id))
    if field is None:
        raise NotFound
    version = await session.get_one(DocumentVersion, field.document_version_id)
    doc = await session.get_one(Document, version.document_id)
    pkg = await locked_package(session, doc.package_id)
    invoices, _ = await reads.invoices(session, [pkg.id])
    inv = invoices.get(pkg.id)
    if inv is None or inv.document_version_id != version.id:
        raise Conflict("Bu sahə faktura sənədinin köhnə versiyasına aiddir; səhifəni yeniləyin.")
    if pkg.processing:
        raise PackageNotReady(details={"status": "PROCESSING"})
    if expected_version != pkg.version:
        raise Conflict(
            f"Paket v{pkg.version}-ə yenilənib; səhifəni yeniləyin.",
            {"current_version": pkg.version, "expected_version": expected_version},
        )
    if len(reason.strip()) < MIN_REASON:
        raise _bad(f"Səbəb ən azı {MIN_REASON} simvol olmalıdır.", "reason")
    value = value.strip()
    unread = field.review_status == "REVIEW_REQUIRED"
    before = f"{field.raw_value or '?'} (oxunmur)" if unread else (field.normalized_value or "—")
    if field.field_path == INVOICE_PO:
        if not _PO.match(value):
            raise _bad("Sifariş nömrəsi PO-123 formatında olmalıdır.")
        inv.po_ref, inv.po_raw = value, None
    elif m := _LINE.match(field.field_path):
        line = await session.scalar(
            select(ExtractedInvoiceLine).where(
                ExtractedInvoiceLine.extracted_invoice_id == inv.id,
                ExtractedInvoiceLine.product_code == m.group(1),
            )
        )
        if line is None:
            raise NotFound
        if m.group(2) == "qty":
            line.qty = _amount(value, 3, "Miqdar müsbət ədəd olmalıdır.")
        else:
            line.unit_price = _amount(value, 2, "Vahid qiymət 100.00 formatında olmalıdır.")
    else:
        raise _bad("Bu sahə düzəldilə bilməz.", "field")
    field.normalized_value, field.review_status = value, "CORRECTED"
    field.corrected_by, field.correction_reason = actor_id, reason.strip()
    await session.flush()
    if version.status == DocumentStatus.REVIEW_REQUIRED and not await _still_unread(
        session, version
    ):
        version.status = DocumentStatus.EXTRACTED
    await bump(session, pkg, "kritik sahə əl ilə düzəldildi")
    await record(
        session,
        actor_id=actor_id,
        action="field.corrected",
        message=f"{field.field_path}: “{before}” → “{value}” · səbəb: {reason.strip()} · "
        "sənədin özü dəyişmədi",
        object_type="extracted_field",
        object_id=field.id,
        package=pkg,
        detail={"from": before, "to": value, "reason": reason.strip()},
    )
    await revalidate(session, pkg)
    await session.commit()
    return pkg.id


async def _still_unread(session: AsyncSession, version: DocumentVersion) -> bool:
    left = await session.scalar(
        select(ExtractedField.id).where(
            ExtractedField.document_version_id == version.id,
            ExtractedField.review_status == "REVIEW_REQUIRED",
        )
    )
    return left is not None
