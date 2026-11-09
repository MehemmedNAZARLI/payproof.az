"""Export (state-machines.md): selected current versions + manifest.json in one zip — never AI
explanations, comments or audit (internal report only). Order: 403 (route) → 409 VERSION_CONFLICT
→ 200 existing → 409 PACKAGE_NOT_READY → 422 INVOICE_REQUIRED → 200 new."""

import datetime as dt
import io
import json
import uuid
import zipfile
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.errors import Conflict, DomainError, ErrorCode, InvalidInput, PackageNotReady
from payproof.domain.enums import PackageStatus
from payproof.repositories.models import (
    ApprovalRecord,
    Document,
    DocumentVersion,
    ExportRecord,
    InvoicePackage,
    RequirementSet,
)
from payproof.services.audit import record
from payproof.services.linking import locked_package
from payproof.services.package_query import load_states
from payproof.storage.s3 import Storage


class InvoiceRequired(DomainError):
    status_code = 422
    code = ErrorCode.INVOICE_REQUIRED
    message = "Fakturanın cari versiyası seçilməlidir."


@dataclass(frozen=True)
class Exported:
    export: ExportRecord
    rule_set_version: int
    zip_key: str
    created: bool


def zip_key(manifest_key: str) -> str:
    return manifest_key.rsplit("/", 1)[0] + "/package.zip"


async def _current_versions(
    session: AsyncSession, pkg: InvoicePackage
) -> dict[uuid.UUID, tuple[DocumentVersion, str]]:
    rows = await session.execute(
        select(DocumentVersion, Document.type)
        .join(Document, Document.id == DocumentVersion.document_id)
        .where(Document.package_id == pkg.id)
        .order_by(DocumentVersion.version_no)
    )
    latest: dict[uuid.UUID, tuple[DocumentVersion, str]] = {}
    for v, doc_type in rows.all():
        latest[v.document_id] = (v, doc_type)  # the last one per document wins
    return {v.id: (v, t) for v, t in latest.values()}


async def export(
    session: AsyncSession,
    storage: Storage,
    *,
    actor_id: uuid.UUID,
    package_id: uuid.UUID,
    expected_version: int,
    expected_rule_set_version: int,
    version_ids: list[uuid.UUID],
) -> Exported:
    pkg = await locked_package(session, package_id)
    [state] = await load_states(session, [pkg.id])
    rs = await session.get(RequirementSet, state.rule_set_id) if state.rule_set_id else None
    if expected_version != pkg.version or rs is None or expected_rule_set_version != rs.version:
        raise Conflict(
            f"Paket v{pkg.version}-ə yenilənib; səhifəni yeniləyin.",
            {"current_version": pkg.version, "expected_version": expected_version},
        )
    done = await session.scalar(
        select(ExportRecord).where(
            ExportRecord.package_id == pkg.id, ExportRecord.package_version == pkg.version
        )
    )
    if done:
        return Exported(done, rs.version, zip_key(done.manifest_key), created=False)
    if state.status is not PackageStatus.APPROVED_READY:
        raise PackageNotReady(
            "Paket təsdiqlənməyib — ixrac edilə bilməz.", {"status": state.status.value}
        )
    if not version_ids:
        raise InvalidInput("Ən azı bir sənəd seçin.", {"fields": {"document_version_ids": "boş"}})
    current = await _current_versions(session, pkg)
    if unknown := [str(i) for i in version_ids if i not in current]:
        raise InvalidInput(
            "Yalnız paketin cari sənəd versiyaları seçilə bilər.",
            {"fields": {"document_version_ids": unknown}},
        )
    chosen = [current[i] for i in version_ids]
    if not any(t == "invoice" for _, t in chosen):
        raise InvoiceRequired
    approval = await session.scalar(
        select(ApprovalRecord).where(
            ApprovalRecord.package_id == pkg.id,
            ApprovalRecord.package_version == pkg.version,
            ApprovalRecord.valid.is_(True),
        )
    )
    assert approval is not None  # noqa: S101 — APPROVED_READY implies it
    files = [
        {"document_version_id": str(v.id), "type": t, "file_name": v.file_name} for v, t in chosen
    ]
    prefix = f"{pkg.company_id}/{pkg.id}/exports/v{pkg.version}"
    manifest = {
        "invoice_number": pkg.invoice_number,
        "package_version": pkg.version,
        "requirement_set_version": rs.version,
        "approved_at": approval.created_at.isoformat(),
        "exported_at": dt.datetime.now(dt.UTC).isoformat(),
        "files": [
            {**f, "sha256": v.sha256, "size": v.size}
            for f, (v, _) in zip(files, chosen, strict=True)
        ],
        "note": "Paket göndərilməyə hazırdır. Bu, ödəniş təsdiqi deyil.",
    }
    body = json.dumps(manifest, ensure_ascii=False, indent=2).encode()
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("manifest.json", body)
        for v, t in chosen:
            z.writestr(f"{t}/{v.file_name}", await storage.get(v.storage_key))
    await storage.put(f"{prefix}/manifest.json", body, "application/json")
    await storage.put(f"{prefix}/package.zip", buf.getvalue(), "application/zip")
    rec = ExportRecord(
        company_id=pkg.company_id, package_id=pkg.id, package_version=pkg.version,
        approval_id=approval.id, files=files, manifest_key=f"{prefix}/manifest.json",
        created_by=actor_id,
    )  # fmt: skip
    session.add(rec)
    await session.flush()
    await record(
        session, actor_id=actor_id, action="export.created",
        message=f"v{pkg.version} · manifest: {', '.join(f['file_name'] for f in files)}",
        object_type="export", object_id=rec.id, package=pkg,
    )  # fmt: skip
    return Exported(rec, rs.version, f"{prefix}/package.zip", created=True)
