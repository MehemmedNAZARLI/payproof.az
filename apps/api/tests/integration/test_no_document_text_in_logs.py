"""Document text never reaches the logs (security.md): not on success, not on a crash."""

import logging
import uuid

import pymupdf
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from payproof.domain.enums import DocumentStatus
from payproof.extraction.pdf import PdfTextAdapter
from payproof.extraction.pipeline import adapter_extractor
from payproof.repositories.base import bind_tenant
from payproof.repositories.models import InvoicePackage
from payproof.seed.cli import seed
from payproof.seed.fixtures import uid
from payproof.seed.identity import COMPANY_ID
from payproof.services.upload import Upload, upload
from payproof.storage.s3 import get_storage
from payproof.worker.extract import extract_handler
from payproof.worker.queue import PostgresQueue
from payproof.worker.runner import run_once

MARKER = "CONFIDENTIAL-CLAUSE-7731"  # text that only exists inside the document


def _pdf() -> bytes:
    doc = pymupdf.open()  # type: ignore[no-untyped-call]
    doc.new_page().insert_text((72, 72), f"PO: PO-381\n{MARKER}\nKY-10 12 kg 100,00")
    return bytes(doc.tobytes())  # type: ignore[no-untyped-call]


async def _boom(*_: object) -> DocumentStatus:
    raise ValueError(f"parser choked on: {MARKER}")


@pytest.mark.parametrize("crash", [False, True])
async def test_document_text_is_never_logged(
    db: AsyncSession, caplog: pytest.LogCaptureFixture, crash: bool
) -> None:
    caplog.set_level(logging.DEBUG)
    await seed(db)
    bind_tenant(db, COMPANY_ID)
    pkg = await db.get_one(InvoicePackage, uid("pkg_1044"))
    await upload(
        db, get_storage(), actor_id=uid("u1"), package_id=pkg.id, doc_type="invoice",
        up=Upload("INV-1044_v9.pdf", _pdf(), pkg.version), endpoint="uploadDocument",
        key=uuid.uuid4(),
    )  # fmt: skip
    sessions = async_sessionmaker(
        bind=await db.connection(), join_transaction_mode="create_savepoint", expire_on_commit=False
    )
    extract = _boom if crash else adapter_extractor(PdfTextAdapter(), get_storage())
    assert await run_once(sessions, PostgresQueue(), {"extract_document": extract_handler(extract)})
    assert MARKER not in caplog.text
    assert all(MARKER not in str(r.args) for r in caplog.records)
