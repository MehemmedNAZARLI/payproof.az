"""The AI interface in the worker path: configured packages store schema-driven extractions and
re-validate; invoice packages map the same answers onto the R-rule shape. No network."""

import copy
import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.extraction.generic import GenericData
from payproof.extraction.llm import LlmFile
from payproof.extraction.llm_invoice import LlmInvoiceAdapter
from payproof.extraction.mock import MockExtractionAdapter
from payproof.extraction.pipeline import adapter_extractor
from payproof.repositories.base import bind_tenant
from payproof.repositories.models import (
    AuditEvent,
    DocumentVersion,
    GenericExtraction,
    InvoicePackage,
)
from payproof.seed.cli import seed
from payproof.seed.fixtures import FIXTURES, uid
from payproof.seed.identity import COMPANY_ID
from payproof.services.package_query import load_states
from payproof.services.validation import revalidate
from payproof.storage.s3 import get_storage
from tests.integration.test_extraction_pipeline import PDF, _process

SCENARIO = json.loads((FIXTURES / "scenarios/unec.json").read_text())
BANK = next(d for d in SCENARIO["packages"][0]["documents"] if d["type"] == "bank_statement")


class Fake:
    provider, model = "anthropic", "claude-opus-5-5"

    def __init__(self, result: GenericData) -> None:
        self.result = result
        self.seen: list[str] = []

    async def extract(self, file: LlmFile, document_type: dict[str, Any]) -> GenericData:
        self.seen.append(document_type["key"])
        return self.result


async def test_configured_document_is_read_stored_and_revalidated(db: AsyncSession) -> None:
    await seed(db)
    bind_tenant(db, COMPANY_ID)
    v1 = await db.get_one(DocumentVersion, uid(f"{BANK['id']}:v1"))
    v2 = DocumentVersion(
        company_id=COMPANY_ID, document_id=v1.document_id, version_no=2,
        file_name=v1.file_name, storage_key=f"test/{v1.id}/v2.pdf", sha256="0" * 64,
        mime="application/pdf", size=len(PDF), pages=2, source_kind="pdf",
        uploaded_by=uid("u1"), package_version_at_upload=1,
    )  # fmt: skip
    db.add(v2)
    await db.flush()
    await get_storage().put(v2.storage_key, PDF, "application/pdf")
    holder_unread = copy.deepcopy(BANK)
    holder_unread["fields"]["account_holder"] = None
    holder_unread["unreadable"] = ["account_holder"]
    ai = Fake(GenericData(holder_unread["fields"], holder_unread["unreadable"],
                          holder_unread["tables"], holder_unread["evidence"]))  # fmt: skip
    status = await adapter_extractor(MockExtractionAdapter(), get_storage(), ai)(db, v2)
    assert status == "REVIEW_REQUIRED" and ai.seen == ["bank_statement"]
    stored = await db.scalar(select(GenericExtraction).where(
        GenericExtraction.document_version_id == v2.id))  # fmt: skip
    assert stored is not None and stored.source == "anthropic"
    audit = await db.scalar(select(AuditEvent).where(AuditEvent.action == "document.read_by"))
    assert audit is not None and audit.detail["model"] == "claude-opus-5-5"
    pkg = await db.get_one(InvoicePackage, uid("unec_0914"))
    await revalidate(db, pkg)
    [state] = await load_states(db, [pkg.id])
    outcomes = {c.rule_id: c.outcome.value for c in state.checks}
    assert state.status.value == "NEEDS_REVIEW"
    assert (outcomes["U-01"], outcomes["U-02"]) == ("UNKNOWN", "UNKNOWN")


def _invoice(po: Any, conf_unread: bool = False) -> GenericData:
    lines = [{"code": "KY-10", "description": None, "qty": "12", "unit": "ədəd",
              "unit_price": "100.00", "amount": "1200.00"}]  # fmt: skip
    fields = {"invoice_number": "INV-1042", "po_ref": po, "currency": "AZN", "total": "1200.00"}
    ev = {k: {"page": 1, "quote": f"{k}: {v}"} for k, v in fields.items() if v}
    unread = ["po_ref"] if conf_unread else []
    ev["lines[0]"] = {"page": 1, "quote": "KY-10"}
    return GenericData(fields, unread, {"lines": lines}, ev)


def _adapter(g: GenericData) -> LlmInvoiceAdapter:
    return LlmInvoiceAdapter(Fake(g), {"invoice": {"key": "invoice"}})


async def test_invoice_package_maps_ai_answers_onto_the_rules(db: AsyncSession) -> None:
    _, checks = await _process(db, "pkg_1042", "INV-1042_v2.pdf", PDF, _adapter(_invoice("PO-381")))
    assert checks["R-001"] == "PASS"


async def test_unread_po_from_ai_is_unknown(db: AsyncSession) -> None:
    adapter = _adapter(_invoice(None, conf_unread=True))
    version, checks = await _process(db, "pkg_1042", "INV-1042_v2.pdf", PDF, adapter)
    assert checks["R-001"] == "UNKNOWN" and version.status == "REVIEW_REQUIRED"
