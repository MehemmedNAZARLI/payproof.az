"""Document upload (new document / new version) and the signed download link."""

import uuid
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, File, Form, Header, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy import select

from payproof.api.deps import Member, Session, require
from payproof.api.ratelimit import UPLOADS
from payproof.core.errors import NotFound
from payproof.domain.permissions import Permission
from payproof.repositories.models import Document, DocumentVersion, InvoicePackage
from payproof.schemas.documents import JobAccepted, SignedUrl
from payproof.services.files import MAX_BYTES
from payproof.services.upload import Upload, upload
from payproof.storage.s3 import Storage, get_storage

router = APIRouter(tags=["documents"])
Editor = Annotated[Member, Depends(require(Permission.EDIT_PACKAGE))]
Viewer = Annotated[Member, Depends(require(Permission.VIEW))]
Store = Annotated[Storage, Depends(get_storage)]
Key = Annotated[uuid.UUID, Header(alias="Idempotency-Key")]
Version = Annotated[int, Form(ge=1)]
ACCEPTED: dict[int | str, dict[str, Any]] = {202: {"model": JobAccepted}}


async def _read(file: UploadFile, expected_version: int) -> Upload:
    # one byte over the limit is enough to answer 413; never more in memory
    return Upload(file.filename or "", await file.read(MAX_BYTES + 1), expected_version)


@router.post(
    "/packages/{package_id}/documents",
    status_code=202,
    responses=ACCEPTED,
    dependencies=[Depends(UPLOADS)],
)
async def upload_document(
    package_id: uuid.UUID,
    session: Session,
    member: Editor,
    storage: Store,
    key: Key,
    type: Annotated[Literal["invoice", "order", "delivery"], Form()],
    file: Annotated[UploadFile, File()],
    expected_version: Version,
) -> JSONResponse:
    out = await upload(
        session,
        storage,
        actor_id=member.user_id,
        package_id=package_id,
        doc_type=type,
        up=await _read(file, expected_version),
        endpoint="uploadDocument",
        key=key,
    )
    return JSONResponse(out.body, status_code=out.status_code)  # 202, or the replayed 409


@router.post(
    "/documents/{document_id}/versions",
    status_code=202,
    responses=ACCEPTED,
    dependencies=[Depends(UPLOADS)],
)
async def upload_document_version(
    document_id: uuid.UUID,
    session: Session,
    member: Editor,
    storage: Store,
    key: Key,
    file: Annotated[UploadFile, File()],
    expected_version: Version,
) -> JSONResponse:
    doc = await session.scalar(select(Document).where(Document.id == document_id))
    if doc is None:
        raise NotFound  # also another company's document
    out = await upload(
        session,
        storage,
        actor_id=member.user_id,
        package_id=doc.package_id,
        doc_type=doc.type,
        up=await _read(file, expected_version),
        endpoint="uploadDocumentVersion",
        key=key,
    )
    return JSONResponse(out.body, status_code=out.status_code)


@router.get("/documents/versions/{version_id}/file")
async def document_file_url(
    version_id: uuid.UUID, session: Session, _: Viewer, storage: Store
) -> SignedUrl:
    version = await session.scalar(
        select(DocumentVersion)
        .join(Document, Document.id == DocumentVersion.document_id)
        .join(InvoicePackage, InvoicePackage.id == Document.package_id)
        .where(DocumentVersion.id == version_id, InvoicePackage.deleted_at.is_(None))
    )
    if version is None:
        raise NotFound
    url, expires_at = storage.signed_url(version.storage_key, version.file_name)
    return SignedUrl(url=url, expires_at=expires_at)
