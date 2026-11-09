"""Store a validated generic extraction (ADR-0011) for one document version, with an evidence row
per cited key (`seller`, `transactions[2]`) and one for the document as a whole (page 1)."""

from sqlalchemy.ext.asyncio import AsyncSession

from payproof.domain.enums import DocumentStatus
from payproof.extraction.generic import GenericData, validate_generic
from payproof.repositories.models import (
    DocumentTypeEntry,
    DocumentVersion,
    EvidenceRef,
    GenericExtraction,
)

WHOLE = "document"  # field_path of the whole-document citation (check library `whole()`)


async def store_generic(
    s: AsyncSession, v: DocumentVersion, entry: DocumentTypeEntry, data: GenericData, source: str
) -> DocumentStatus:
    validate_generic(data, entry.extraction, pages=v.pages or 1)
    s.add(
        GenericExtraction(
            company_id=v.company_id,
            document_version_id=v.id,
            document_type=entry.key,
            document_type_version=entry.version,
            fields=data.fields,
            unreadable=list(data.unreadable),
            tables=data.tables,
            evidence=data.evidence,
            source=source,
        )
    )
    s.add_all(
        EvidenceRef(
            company_id=v.company_id,
            document_version_id=v.id,
            field_path=key,
            page=e["page"],
            quote=e["quote"],
        )
        for key, e in data.evidence.items()
    )
    s.add(EvidenceRef(company_id=v.company_id, document_version_id=v.id, field_path=WHOLE,
                      page=1, quote=v.file_name))  # fmt: skip
    status = DocumentStatus.REVIEW_REQUIRED if data.unreadable else DocumentStatus.EXTRACTED
    v.status = status.value
    await s.flush()
    return status
