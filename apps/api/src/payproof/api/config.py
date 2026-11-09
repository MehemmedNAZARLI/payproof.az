"""ADR-0011 configuration: document type registry, check library, output template upload."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile

from payproof.api.deps import Member, Session, require
from payproof.domain.permissions import Permission
from payproof.repositories import package_reads as reads
from payproof.schemas import config as cfg
from payproof.schemas.auth import UserRef
from payproof.services import output_templates, registry
from payproof.storage.s3 import Storage, get_storage

router = APIRouter(tags=["customers"])
Viewer = Annotated[Member, Depends(require(Permission.VIEW))]
RuleKeeper = Annotated[Member, Depends(require(Permission.MANAGE_REQUIREMENTS))]
Store = Annotated[Storage, Depends(get_storage)]


@router.get("/document-types")
async def list_document_types(session: Session, _: Viewer) -> cfg.DocumentTypes:
    entries = sorted((await registry.current(session)).values(), key=lambda e: not e.builtin)
    return cfg.DocumentTypes(
        items=[
            cfg.DocumentTypeInfo(
                key=e.key,
                name=e.name,
                version=e.version,
                builtin=e.builtin,
                accepted_formats=e.accepted_formats,
                extraction=e.extraction,
            )
            for e in entries  # instructions stay server-side (extraction prompt)
        ]
    )


@router.get("/check-library")
async def get_check_library(_: Viewer) -> cfg.CheckLibrary:
    return cfg.CheckLibrary.model_validate(registry.load_library())


@router.post("/customers/{customer_id}/output-templates", status_code=201)
async def upload_output_template(
    customer_id: uuid.UUID,
    session: Session,
    member: RuleKeeper,
    storage: Store,
    file: Annotated[UploadFile, File()],
) -> cfg.OutputTemplate:
    data = await file.read(output_templates.MAX_BYTES + 1)  # one byte over is enough for 413
    t = await output_templates.upload_template(
        session, storage, actor_id=member.user_id, customer_id=customer_id,
        file_name=file.filename or "", data=data,
    )  # fmt: skip
    user, role = (await reads.owners(session, {t.uploaded_by}))[t.uploaded_by]
    return cfg.OutputTemplate(
        id=t.id, file_name=t.file_name, sha256=t.sha256, size=t.size,
        placeholders=t.placeholders, created_at=t.created_at,
        uploaded_by=UserRef(id=user.id, full_name=user.full_name, title=user.title, role=role),
    )  # fmt: skip
