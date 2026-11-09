"""Export of a configured package (ADR-0011 §4): required document types, the output template
filled from validated values only, and its manifest entries. A missing value refuses the export
(422 `missing_placeholders`) — a partially filled document is never produced."""

from dataclasses import dataclass
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.errors import InvalidInput
from payproof.domain.checks.template import fill_template
from payproof.repositories.models import ApprovalRecord, InvoicePackage, RequirementSet, User
from payproof.services import output_templates
from payproof.services.generic_validation import generic_package
from payproof.services.output_fill import manifest_values, render
from payproof.storage.s3 import Storage

BAKU = ZoneInfo("Asia/Baku")


@dataclass(frozen=True)
class FilledOutput:
    file_name: str
    data: bytes
    values: list[dict[str, Any]]  # placeholder, value, source, evidence (manifest)
    submission_address: str


def require_documents(rs: RequirementSet, chosen_types: list[str]) -> None:
    """Every required type (min_count ≥ 1) is in the export; replaces INVOICE_REQUIRED."""
    missing = [d["type"] for d in rs.documents or []
               if d["min_count"] >= 1 and d["type"] not in chosen_types]  # fmt: skip
    if missing:
        raise InvalidInput(
            "Tələb olunan sənəd növləri ixraca seçilməyib.",
            {"fields": {"document_version_ids": f"tələb olunur: {', '.join(missing)}"}},
        )


async def fill_output(
    session: AsyncSession, storage: Storage, pkg: InvoicePackage, rs: RequirementSet,
    approval: ApprovalRecord,
) -> FilledOutput:  # fmt: skip
    assert rs.output is not None  # noqa: S101 — caller checks
    p = await generic_package(session, pkg, rs)
    approver = await session.get_one(User, approval.approver_id)
    approved_on = approval.created_at.astimezone(BAKU).date().isoformat()
    fill = fill_template(
        p or {"documents": [], "reference": pkg.reference},
        {"output": rs.output},
        {"approver_name": approver.full_name, "approved_on": approved_on},
    )
    if p is None or fill["missing"]:
        raise InvalidInput(
            "Çıxış şablonu doldurula bilmir: bəzi sahələr təsdiqlənmiş mənbədən oxunmayıb.",
            {"missing_placeholders": fill["missing"]},
        )
    tpl = rs.output["template"]
    stored = await output_templates.find(session, pkg.customer_id, tpl["sha256"])
    if stored is None:  # validated when the set was saved; a deleted file is a server fault
        raise RuntimeError("output template missing from storage")
    data = render(await storage.get(stored.storage_key), {v["placeholder"]: v["value"]
                                                          for v in fill["values"]})  # fmt: skip
    stem = tpl["file_name"].removesuffix(".docx")
    return FilledOutput(
        file_name=f"{stem}_{pkg.reference}.docx",
        data=data,
        values=manifest_values(p, rs.output["placeholders"], fill["values"]),
        submission_address=rs.output["submission"]["address"],
    )


def output_record(filled: FilledOutput) -> dict[str, Any]:
    """`ExportRecord.output` (openapi ExportOutput) at export time: submission queued."""
    return {
        "template_file_name": filled.file_name,
        "manifest_file_name": "manifest.json",
        "values": [{"placeholder": v["placeholder"], "value": v["value"]} for v in filled.values],
        "submission": {
            "address": filled.submission_address,
            "status": "QUEUED",
            "attempted_at": None,
        },
    }
