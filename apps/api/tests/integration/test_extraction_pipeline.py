import uuid
from dataclasses import replace

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from payproof.domain.enums import Role
from payproof.domain.rules.engine import evaluate
from payproof.extraction.base import ExtractionAdapter, ExtractionInput, ExtractionResult
from payproof.extraction.mock import MockExtractionAdapter
from payproof.extraction.pipeline import adapter_extractor
from payproof.repositories.base import bind_tenant
from payproof.repositories.models import DocumentVersion, InvoicePackage
from payproof.seed.cli import seed
from payproof.seed.fixtures import uid
from payproof.seed.identity import COMPANY_ID
from payproof.services.package_detail import package_detail
from payproof.services.package_query import load_states
from payproof.services.snapshot_builder import build_snapshot
from payproof.services.upload import Upload, upload
from payproof.storage.s3 import get_storage
from payproof.worker.extract import extract_handler
from payproof.worker.queue import PostgresQueue
from payproof.worker.runner import run_once

PDF = b"%PDF-1.7\n1 0 obj << /Type /Page >> endobj\n"
JPEG = b"\xff\xd8\xff\xe0 scan "


async def _process(
    db: AsyncSession, pkg: str, name: str, data: bytes, adapter: ExtractionAdapter | None = None
) -> tuple[DocumentVersion, dict[str, str]]:
    """Upload → worker → engine on the stored extraction (B-17 will persist the run)."""
    await seed(db)
    bind_tenant(db, COMPANY_ID)
    p = await db.get_one(InvoicePackage, uid(pkg))
    up = Upload(name, data + uuid.uuid4().bytes, p.version)
    out = await upload(
        db, get_storage(), actor_id=uid("u1"), package_id=p.id, doc_type="invoice",
        up=up, endpoint="uploadDocument", key=uuid.uuid4(),
    )  # fmt: skip
    sessions = async_sessionmaker(
        bind=await db.connection(), join_transaction_mode="create_savepoint", expire_on_commit=False
    )
    handler = extract_handler(adapter_extractor(adapter or MockExtractionAdapter(), get_storage()))
    assert await run_once(sessions, PostgresQueue(), {"extract_document": handler})
    version = await db.get_one(
        DocumentVersion, uuid.UUID(out.body["document_version_id"]), populate_existing=True
    )
    [state] = await load_states(db, [p.id])
    snapshot = await build_snapshot(db, state)
    assert snapshot is not None
    return version, {c.rule_id: c.outcome.value for c in evaluate(snapshot)}


async def test_corrected_invoice_with_po_passes_r001(db: AsyncSession) -> None:
    version, checks = await _process(db, "pkg_1042", "INV-1042_v2_PO-381.pdf", PDF)
    assert version.status == "EXTRACTED" and checks["R-001"] == "PASS"


async def test_scan_needs_review_and_its_po_is_unknown(db: AsyncSession) -> None:
    version, checks = await _process(db, "pkg_1047", "INV-1047_v2.jpg", JPEG)
    assert version.status == "REVIEW_REQUIRED" and checks["R-001"] == "UNKNOWN"


class _UnitNotRead:
    async def extract(self, src: ExtractionInput) -> ExtractionResult:
        r = await MockExtractionAdapter().extract(src)
        assert r.invoice is not None
        lines = tuple(replace(li, unit=None) for li in r.invoice.lines)
        return replace(r, invoice=replace(r.invoice, lines=lines))


async def test_line_units_are_written_with_the_extraction(db: AsyncSession) -> None:
    _, checks = await _process(db, "pkg_1047", "INV-1047_v3.pdf", PDF)
    assert checks["R-004"] == "PASS"  # the new version's lines carry their units


async def test_unread_unit_makes_r004_unknown(db: AsyncSession) -> None:
    _, checks = await _process(db, "pkg_1047", "INV-1047_v3.pdf", PDF, _UnitNotRead())
    assert checks["R-004"] == "UNKNOWN"


async def test_detail_shows_where_each_value_was_read(db: AsyncSession) -> None:
    version, _ = await _process(db, "pkg_1042", "INV-1042_v2_PO-381.pdf", PDF)
    detail = await package_detail(db, uid("pkg_1042"), viewer_role=Role.OPERATOR)
    po = next(f for f in detail.fields if f.field_path == "invoice.po_ref")
    assert po.evidence is not None and po.evidence.document_version_id == version.id
    assert (po.evidence.page, po.evidence.quote) == (1, "Sifariş №: PO-381")
    cells = [c for row in detail.comparison.rows for c in (row.invoice, row.delivery) if c]
    assert any(c.evidence and c.evidence.document_version_id == version.id for c in cells)
