import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.domain.enums import DocumentStatus
from payproof.extraction.base import Evidence, ExtractionResult, InvoiceData, LineData
from payproof.extraction.persist import store
from payproof.repositories.base import bind_tenant
from payproof.repositories.models import (
    DocumentVersion,
    EvidenceRef,
    ExtractedField,
    ExtractedInvoice,
    InvoicePackage,
)
from payproof.seed.cli import seed
from payproof.seed.fixtures import uid
from payproof.seed.identity import COMPANY_ID
from payproof.services.upload import Upload, upload
from payproof.storage.s3 import get_storage


async def _new_version(db: AsyncSession) -> tuple[DocumentVersion, InvoicePackage]:
    await seed(db)
    bind_tenant(db, COMPANY_ID)
    pkg = await db.get_one(InvoicePackage, uid("pkg_1047"))
    out = await upload(
        db,
        get_storage(),
        actor_id=uid("u1"),
        package_id=pkg.id,
        doc_type="invoice",
        up=Upload("INV-1047_v2.pdf", b"%PDF-1.7 persist " + uuid.uuid4().bytes, pkg.version),
        endpoint="uploadDocument",
        key=uuid.uuid4(),
    )
    vid = uuid.UUID(out.body["document_version_id"])
    return await db.get_one(DocumentVersion, vid), pkg


async def test_unread_po_is_stored_for_review_with_its_evidence(db: AsyncSession) -> None:
    version, pkg = await _new_version(db)
    invoice = InvoiceData(
        po_ref=None,
        po_raw="PO-38?",
        currency="AZN",
        total=Decimal("100.00"),
        lines=(LineData("KY-10", Decimal(1), None, Decimal("100.00")),),
        unreadable=frozenset({"invoice.po_ref"}),
    )
    result = ExtractionResult(
        "mock", invoice=invoice, evidence=(Evidence("invoice.po_ref", 1, "Sifariş №: PO-38?"),)
    )

    assert await store(db, version, pkg, result) is DocumentStatus.REVIEW_REQUIRED

    head = await db.scalar(
        select(ExtractedInvoice).where(ExtractedInvoice.document_version_id == version.id)
    )
    assert head is not None and (head.po_ref, head.po_raw) == (None, "PO-38?")
    fields = {
        f.field_path: f
        for f in await db.scalars(
            select(ExtractedField).where(ExtractedField.document_version_id == version.id)
        )
    }
    po = fields["invoice.po_ref"]
    assert (po.raw_value, po.review_status) == ("PO-38?", "REVIEW_REQUIRED")
    assert fields["invoice.lines[KY-10].unit_price"].normalized_value == "100.00"
    [ev] = await db.scalars(
        select(EvidenceRef).where(EvidenceRef.document_version_id == version.id)
    )
    assert (ev.field_path, ev.page, ev.quote) == ("invoice.po_ref", 1, "Sifariş №: PO-38?")
    assert pkg.currency == "AZN"
