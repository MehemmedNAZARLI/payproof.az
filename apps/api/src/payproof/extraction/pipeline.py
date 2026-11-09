"""File → adapter (AI_PROVIDER) → validate → store. Plugs into the `extract_document` job."""

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.settings import get_settings
from payproof.domain.enums import DocumentStatus
from payproof.extraction.base import ExtractionAdapter, ExtractionInput, validate
from payproof.extraction.generic_persist import store_generic
from payproof.extraction.llm import PROMPT_VERSION, LlmExtractor
from payproof.extraction.llm_invoice import LlmInvoiceAdapter, llm_file
from payproof.extraction.mock import MockExtractionAdapter
from payproof.extraction.pdf import PdfTextAdapter
from payproof.extraction.persist import store
from payproof.extraction.previous import extraction_input
from payproof.extraction.providers.select import get_extractor
from payproof.repositories.models import Document, DocumentVersion, InvoicePackage
from payproof.services import registry
from payproof.services.audit import record
from payproof.storage.s3 import Storage
from payproof.worker.extract import Extractor

log = logging.getLogger(__name__)


def _types() -> dict[str, dict[str, Any]]:
    """Current registry entries from the configuration file (the worker needs no DB for it)."""
    return {e["key"]: e for e in sorted(registry.load_entries(), key=lambda e: e["version"])}


def get_adapter(provider: str | None = None) -> ExtractionAdapter:
    settings = get_settings()
    provider = provider or settings.ai_provider
    if provider == "mock":
        return MockExtractionAdapter()
    if provider == "pdf":
        return PdfTextAdapter()
    # anthropic | openai: the one AI interface, mapped onto invoice/delivery for the R-rules
    return LlmInvoiceAdapter(get_extractor(settings), _types())


async def _generic(
    s: AsyncSession, version: DocumentVersion, doc: Document, data: bytes, ai: LlmExtractor
) -> DocumentStatus:
    """ADR-0011 configured package: registry schema → AI interface → validate → store."""
    entry = (await registry.current(s))[doc.type]
    src = ExtractionInput(version.file_name, data, doc.type, version.source_kind == "scan",
                          doc.package_id, "", None, None)  # fmt: skip
    file = await llm_file(src)
    shape = {"key": entry.key, "name": entry.name, "extraction": entry.extraction,
             "instructions": entry.instructions}  # fmt: skip
    result = await ai.extract(file, shape)
    status = await store_generic(s, version, entry, result, ai.provider)
    await _provenance(s, version, ai)
    return status


async def _provenance(s: AsyncSession, version: DocumentVersion, ai: LlmExtractor) -> None:
    """Which provider, model and prompt version read the file (audit metadata; no content)."""
    doc = await s.get_one(Document, version.document_id)
    pkg = await s.get_one(InvoicePackage, doc.package_id)
    log.info("extracted version=%s provider=%s model=%s prompt=%s",
             version.id, ai.provider, ai.model, PROMPT_VERSION)  # fmt: skip
    await record(
        s, actor_id=None, action="document.read_by", object_type="document_version",
        object_id=version.id, package=pkg,
        message=f"{version.file_name}: çıxarış — {ai.provider} ({ai.model})",
        detail={"provider": ai.provider, "model": ai.model, "prompt_version": PROMPT_VERSION},
    )  # fmt: skip


def adapter_extractor(
    adapter: ExtractionAdapter, storage: Storage, ai: LlmExtractor | None = None
) -> Extractor:
    ai = ai or get_extractor(get_settings())

    async def extract(s: AsyncSession, version: DocumentVersion) -> DocumentStatus:
        doc = await s.get_one(Document, version.document_id)
        pkg = await s.get_one(InvoicePackage, doc.package_id)
        data = await storage.get(version.storage_key)
        if pkg.reference is not None:  # configured package (InvalidExtraction → retry, FAILED)
            return await _generic(s, version, doc, data, ai)
        result = await adapter.extract(await extraction_input(s, version, pkg, doc.type, data))
        validate(result, pages=version.pages or 1)  # InvalidExtraction → retry, then FAILED
        status = await store(s, version, pkg, result)
        if isinstance(adapter, LlmInvoiceAdapter):
            await _provenance(s, version, adapter.extractor)
        return status

    return extract
