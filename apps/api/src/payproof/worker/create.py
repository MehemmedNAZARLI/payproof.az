"""`create_package` job: extract every first version (invoice first), end processing, then
link the exact PO and re-validate — the same path as a single upload."""

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.domain.enums import DocumentStatus
from payproof.repositories.models import Document, DocumentVersion, InvoicePackage, Job
from payproof.services.audit import record
from payproof.services.linking import after_extraction
from payproof.worker.extract import Extractor, no_extraction
from payproof.worker.runner import Handler

_ORDER = {"invoice": 0, "order": 1, "delivery": 2}  # the delivery mock reads the invoice lines


async def _versions(s: AsyncSession, pkg: InvoicePackage) -> list[DocumentVersion]:
    rows = await s.execute(
        select(DocumentVersion, Document.type)
        .join(Document, Document.id == DocumentVersion.document_id)
        .where(Document.package_id == pkg.id)
    )
    return [v for v, _ in sorted(rows.all(), key=lambda r: _ORDER[r[1]])]


def create_handler(extract: Extractor = no_extraction) -> Handler:
    async def run(s: AsyncSession, job: Job) -> dict[str, Any]:
        pkg = await s.get_one(InvoicePackage, uuid.UUID(job.payload["package_id"]))
        for v in await _versions(s, pkg):
            v.status = await extract(s, v)
            await s.flush()
        pkg.processing = False
        await record(
            s, actor_id=None, action="document.extracted",
            message="Sahələr və mənbə istinadları çıxarıldı", package=pkg,
        )  # fmt: skip
        await after_extraction(s, pkg)  # exact PO link + first validation run
        return {"package_id": str(pkg.id), "package_version": pkg.version}

    async def failed(s: AsyncSession, job: Job) -> None:
        pkg = await s.get_one(InvoicePackage, uuid.UUID(job.payload["package_id"]))
        for v in await _versions(s, pkg):
            v.status = DocumentStatus.FAILED
        pkg.processing = False  # a person re-uploads; nothing was evaluated
        await record(
            s, actor_id=None, action="document.failed",
            message="Sənədlər emal oluna bilmədi (texniki xəta) — yenidən yükləyin", package=pkg,
        )  # fmt: skip

    return Handler(run, failed)
