"""`extract_document` job: document version UPLOADED → PROCESSING → EXTRACTED | REVIEW_REQUIRED,
or FAILED after the last attempt (a technical error — never a business PASS)."""

import uuid
from collections.abc import Awaitable, Callable
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from payproof.domain.enums import DocumentStatus
from payproof.repositories.models import DocumentVersion, InvoicePackage, Job
from payproof.services.audit import record
from payproof.services.linking import after_extraction
from payproof.worker.runner import Handler

Extractor = Callable[[AsyncSession, DocumentVersion], Awaitable[DocumentStatus]]


async def no_extraction(_: AsyncSession, __: DocumentVersion) -> DocumentStatus:
    # shortcut: nothing reads the file yet, so a person checks the fields; B-15 plugs the
    # adapters (mock samples, PDF text) in here
    return DocumentStatus.REVIEW_REQUIRED


async def _version(s: AsyncSession, job: Job) -> tuple[DocumentVersion, InvoicePackage]:
    version = await s.get_one(DocumentVersion, uuid.UUID(job.payload["document_version_id"]))
    return version, await s.get_one(InvoicePackage, uuid.UUID(job.payload["package_id"]))


async def _audit(
    s: AsyncSession, version: DocumentVersion, pkg: InvoicePackage, action: str, message: str
) -> None:
    # system actor; the audit row is also the live event that tells the UI (B-12b)
    await record(
        s,
        actor_id=None,
        action=action,
        message=message,
        object_type="document_version",
        object_id=version.id,
        package=pkg,
    )


def extract_handler(extract: Extractor = no_extraction) -> Handler:
    async def run(s: AsyncSession, job: Job) -> dict[str, Any]:
        version, pkg = await _version(s, job)
        version.status = DocumentStatus.PROCESSING
        await s.commit()  # visible while the extraction runs
        status = await extract(s, version)
        version.status = status
        if status is DocumentStatus.EXTRACTED:
            action, what = "document.extracted", "sahələr və mənbə istinadları çıxarıldı"
        else:
            action, what = "document.review", "sahələr avtomatik oxunmadı — əl ilə yoxlayın"
        await _audit(s, version, pkg, action, f"{version.file_name}: {what}")
        await after_extraction(s, pkg)  # exact PO link + re-validation, same transaction
        return {
            "package_id": str(pkg.id),
            "package_version": pkg.version,
            "document_version_id": str(version.id),
        }

    async def failed(s: AsyncSession, job: Job) -> None:
        version, pkg = await _version(s, job)
        version.status = DocumentStatus.FAILED
        message = f"{version.file_name}: sənəd emal oluna bilmədi (texniki xəta) — yenidən yükləyin"
        await _audit(s, version, pkg, "document.failed", message)

    return Handler(run, failed)
