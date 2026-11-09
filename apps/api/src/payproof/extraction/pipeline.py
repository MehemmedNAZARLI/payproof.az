"""File → adapter (AI_PROVIDER) → validate → store. Plugs into the `extract_document` job."""

from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.settings import get_settings
from payproof.domain.enums import DocumentStatus
from payproof.extraction.base import ExtractionAdapter, validate
from payproof.extraction.mock import MockExtractionAdapter
from payproof.extraction.pdf import PdfTextAdapter
from payproof.extraction.persist import store
from payproof.extraction.previous import extraction_input
from payproof.repositories.models import Document, DocumentVersion, InvoicePackage
from payproof.storage.s3 import Storage
from payproof.worker.extract import Extractor


def get_adapter(provider: str | None = None) -> ExtractionAdapter:
    provider = provider or get_settings().ai_provider
    if provider == "mock":
        return MockExtractionAdapter()
    if provider == "pdf":
        return PdfTextAdapter()
    raise NotImplementedError(f"AI_PROVIDER={provider}")  # llm: B-25 (stretch)


def adapter_extractor(adapter: ExtractionAdapter, storage: Storage) -> Extractor:
    async def extract(s: AsyncSession, version: DocumentVersion) -> DocumentStatus:
        doc = await s.get_one(Document, version.document_id)
        pkg = await s.get_one(InvoicePackage, doc.package_id)
        data = await storage.get(version.storage_key)
        result = await adapter.extract(await extraction_input(s, version, pkg, doc.type, data))
        validate(result, pages=version.pages or 1)  # InvalidExtraction → retry, then FAILED
        return await store(s, version, pkg, result)

    return extract
