import uuid

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.errors import Conflict, IdempotencyKeyReused, NotFound, PackageNotReady
from payproof.repositories.base import bind_tenant
from payproof.repositories.models import (
    ApprovalRecord,
    AuditEvent,
    DocumentVersion,
    InvoicePackage,
    Job,
)
from payproof.seed.cli import seed
from payproof.seed.fixtures import uid
from payproof.seed.identity import COMPANY_ID
from payproof.services.upload import Upload, clean_name, upload
from payproof.storage.s3 import get_storage

PDF = b"%PDF-1.7\n1 0 obj << /Type /Page >> endobj\n%%EOF"


@pytest.fixture
async def seeded(db: AsyncSession) -> AsyncSession:
    await seed(db)
    bind_tenant(db, COMPANY_ID)
    return db


async def _upload(
    db: AsyncSession, pkg: str, data: bytes, version: int, key: uuid.UUID | None = None
) -> tuple[int, dict[str, object]]:
    out = await upload(
        db,
        get_storage(),
        actor_id=uid("u1"),
        package_id=uid(pkg),
        doc_type="invoice",
        up=Upload("C:\\Users\\a\\INV-1035_v2.pdf", data, version),
        endpoint="uploadDocument",
        key=key or uuid.uuid4(),
    )
    return out.status_code, out.body


async def test_retry_with_the_same_key_replays(seeded: AsyncSession) -> None:
    db, key = seeded, uuid.uuid4()
    version = (await db.get_one(InvoicePackage, uid("pkg_1035"))).version
    first = await _upload(db, "pkg_1035", PDF + b"once", version, key)
    again = await _upload(db, "pkg_1035", PDF + b"once", version, key)  # stale version: replay wins
    assert again == first
    count = await db.scalar(select(func.count()).select_from(DocumentVersion))
    with pytest.raises(IdempotencyKeyReused):
        await _upload(db, "pkg_1035", PDF + b"other", version, key)
    assert await db.scalar(select(func.count()).select_from(DocumentVersion)) == count


async def test_new_version_keeps_the_old_one_and_stores_the_file(seeded: AsyncSession) -> None:
    db = seeded
    pkg = await db.get_one(InvoicePackage, uid("pkg_1035"))
    status, body = await _upload(db, "pkg_1035", PDF + b"new", pkg.version)

    assert status == 202
    v = await db.get_one(DocumentVersion, uuid.UUID(str(body["document_version_id"])))
    assert (v.file_name, v.version_no, v.status, v.size) == (
        "INV-1035_v2.pdf",
        2,
        "UPLOADED",
        len(PDF) + 3,
    )
    assert (v.mime, v.pages, v.uploaded_by) == ("application/pdf", 1, uid("u1"))
    assert await get_storage().get(v.storage_key) == PDF + b"new"
    old = await db.scalar(
        select(DocumentVersion).where(
            DocumentVersion.document_id == v.document_id, DocumentVersion.version_no == 1
        )
    )
    assert old is not None  # versions are never replaced


async def test_refusals_write_nothing(seeded: AsyncSession) -> None:
    db = seeded
    version = (await db.get_one(InvoicePackage, uid("pkg_1035"))).version
    with pytest.raises(Conflict) as stale:
        await _upload(db, "pkg_1035", PDF, version - 1)
    assert stale.value.details == {"current_version": version, "expected_version": version - 1}
    with pytest.raises(PackageNotReady):
        await _upload(db, "pkg_1050", PDF, 1)
    with pytest.raises(NotFound):
        await _upload(db, "pkg_unknown", PDF, 1)


def test_clean_name_keeps_only_the_base_name() -> None:
    assert clean_name("../../etc/passwd") == "passwd"
    assert clean_name("C:\\tmp\\Təhvil.pdf") == "Təhvil.pdf"
    assert clean_name("   ") == "fayl"


async def test_new_version_bumps_package_invalidates_approval_and_queues_job(
    seeded: AsyncSession,
) -> None:
    db = seeded
    pkg = await db.get_one(InvoicePackage, uid("pkg_1035"))
    before = pkg.version
    _, body = await _upload(db, "pkg_1035", PDF + b"bump", before)

    v = await db.get_one(DocumentVersion, uuid.UUID(str(body["document_version_id"])))
    assert pkg.version == v.package_version_at_upload == before + 1
    job = await db.get_one(Job, uuid.UUID(str(body["job_id"])))
    assert (job.kind, job.status, job.company_id) == ("extract_document", "QUEUED", COMPANY_ID)
    assert job.payload["document_version_id"] == str(v.id)
    approval = await db.scalar(select(ApprovalRecord).where(ApprovalRecord.package_id == pkg.id))
    assert approval is not None and not approval.valid
    assert approval.invalidated_reason == "fakturanın yeni versiyası yükləndi"
    uploaded = await db.scalar(select(AuditEvent).where(AuditEvent.object_id == v.id))
    assert uploaded is not None and (uploaded.action, uploaded.actor_id) == (
        "document.uploaded",
        uid("u1"),
    )
    assert uploaded.message == f"Faktura: INV-1035_v2.pdf (sənəd v2) · paket v{before + 1}"


async def test_duplicate_is_audited_and_creates_no_version(seeded: AsyncSession) -> None:
    db = seeded
    version = (await db.get_one(InvoicePackage, uid("pkg_1035"))).version
    _, first = await _upload(db, "pkg_1035", PDF + b"dup", version)
    count = await db.scalar(select(func.count()).select_from(DocumentVersion))
    pkg = await db.get_one(InvoicePackage, uid("pkg_1035"))

    status, body = await _upload(db, "pkg_1035", PDF + b"dup", pkg.version)

    assert status == 409
    assert body["error"] == {
        "code": "DUPLICATE_FILE",
        "message": "INV-1035_v2.pdf: Faktura v2 ilə eyni fayldır — yeni versiya yaradılmadı.",
        "details": {"document_version_id": first["document_version_id"], "version_no": 2},
    }
    assert await db.scalar(select(func.count()).select_from(DocumentVersion)) == count
    assert pkg.version == version + 1  # unchanged by the duplicate
    audit = await db.scalar(select(AuditEvent).where(AuditEvent.action == "document.duplicate"))
    assert audit is not None and audit.message.startswith("Təkrar fayl aşkarlandı: INV-1035_v2.pdf")
