"""Export of the approved version, and the internal report that never leaves the company."""

import datetime as dt
import hashlib
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select

from payproof.api.deps import Member, Session, require
from payproof.core.errors import NotFound
from payproof.domain.permissions import Permission
from payproof.repositories import package_reads as reads
from payproof.repositories.models import ExportRecord, InvoicePackage
from payproof.schemas import detail as d
from payproof.schemas.auth import UserRef
from payproof.schemas.documents import SignedUrl
from payproof.schemas.packages import PackageRef
from payproof.services import idempotency
from payproof.services.export import export, zip_key
from payproof.services.package_detail import package_detail
from payproof.storage.s3 import Storage, get_storage

router = APIRouter(tags=["approval"])
Exporter = Annotated[Member, Depends(require(Permission.EXPORT_PACKAGE))]
Viewer = Annotated[Member, Depends(require(Permission.VIEW))]
ENDPOINT = "exportPackage"


class ExportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_version: int = Field(ge=1)
    expected_requirement_set_version: int = Field(ge=1)
    document_version_ids: list[uuid.UUID]  # empty → 422 from the service (contract)


class ExportResult(BaseModel):
    export: d.ExportRecord
    download: SignedUrl


class InternalReport(BaseModel):
    package: PackageRef
    version: int
    status: str
    requirement_set_version: int
    generated_at: dt.datetime
    summary: d.CheckSummary
    checks: list[d.CheckResult]
    approvals: list[d.ApprovalRecord]
    exports: list[d.ExportRecord]


@router.post("/packages/{package_id}/export")
async def export_package(
    package_id: uuid.UUID,
    body: ExportRequest,
    session: Session,
    member: Exporter,
    storage: Annotated[Storage, Depends(get_storage)],
    key: Annotated[uuid.UUID, Header(alias="Idempotency-Key")],
) -> ExportResult:
    digest = hashlib.sha256(f"{package_id}|{body.model_dump_json()}".encode()).hexdigest()
    # a replay is answered from the stored export, but with a freshly signed link
    replay = await idempotency.claim(session, endpoint=ENDPOINT, key=key, request_hash=digest)
    done = await export(
        session,
        storage,
        actor_id=member.user_id,
        package_id=package_id,
        expected_version=body.expected_version,
        expected_rule_set_version=body.expected_requirement_set_version,
        version_ids=body.document_version_ids,
    )
    users = await reads.owners(session, {done.export.created_by})
    user, role = users[done.export.created_by]
    record = d.ExportRecord(
        id=done.export.id,
        package_version=done.export.package_version,
        requirement_set_version=done.rule_set_version,
        created_by=UserRef(id=user.id, full_name=user.full_name, title=user.title, role=role),
        created_at=done.export.created_at,
        files=[d.ExportFile(**f) for f in done.export.files],
    )
    if replay is None:
        body_out = {"export_id": str(done.export.id)}
        await idempotency.complete(
            session, endpoint=ENDPOINT, key=key, status_code=200, body=body_out
        )
    await session.commit()
    name = f"{done.export.package_version}-paket.zip"
    url, expires_at = storage.signed_url(done.zip_key, name)
    return ExportResult(export=record, download=SignedUrl(url=url, expires_at=expires_at))


@router.get("/exports/{export_id}/download")
async def export_download(
    export_id: uuid.UUID,
    session: Session,
    _: Viewer,
    storage: Annotated[Storage, Depends(get_storage)],
) -> SignedUrl:
    """A fresh link to an existing export's zip — no new export event."""
    row = (
        await session.execute(
            select(ExportRecord, InvoicePackage.invoice_number)
            .join(InvoicePackage, InvoicePackage.id == ExportRecord.package_id)
            .where(ExportRecord.id == export_id, InvoicePackage.deleted_at.is_(None))
        )
    ).first()
    if row is None:
        raise NotFound  # also another company's export
    e, number = row
    url, expires_at = storage.signed_url(
        zip_key(e.manifest_key), f"{number}_v{e.package_version}.zip"
    )
    return SignedUrl(url=url, expires_at=expires_at)


@router.get("/packages/{package_id}/internal-report")
async def internal_report(
    package_id: uuid.UUID, session: Session, member: Viewer
) -> InternalReport:
    p = await package_detail(session, package_id, viewer_role=member.role)
    return InternalReport(
        package=PackageRef(id=p.id, invoice_number=p.invoice_number or ""),
        version=p.version,
        status=p.status,
        requirement_set_version=p.requirement_set.version,
        generated_at=dt.datetime.now(dt.UTC),
        summary=p.summary,
        checks=p.checks,
        approvals=p.approvals,
        exports=p.exports,
    )
