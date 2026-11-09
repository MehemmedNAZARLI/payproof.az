"""Create a package from a document set; delete one that was never approved."""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Form, Header, Response, UploadFile
from fastapi.responses import JSONResponse

from payproof.api.deps import Member, Session, require
from payproof.api.ratelimit import UPLOADS
from payproof.domain.permissions import Permission
from payproof.schemas.documents import JobAccepted
from payproof.services.files import MAX_BYTES
from payproof.services.package_create import NewFile, create_package
from payproof.services.package_delete import delete_package
from payproof.storage.s3 import Storage, get_storage

router = APIRouter(tags=["packages"])
Editor = Annotated[Member, Depends(require(Permission.EDIT_PACKAGE))]
Deleter = Annotated[Member, Depends(require(Permission.DELETE_PACKAGE))]
ACCEPTED: dict[int | str, dict[str, Any]] = {202: {"model": JobAccepted}}


async def _file(doc_type: str, f: UploadFile | None) -> NewFile | None:
    if f is None:
        return None
    return NewFile(doc_type, f.filename or "", await f.read(MAX_BYTES + 1))


@router.post("/packages", status_code=202, responses=ACCEPTED, dependencies=[Depends(UPLOADS)])
async def create(
    session: Session,
    member: Editor,
    storage: Annotated[Storage, Depends(get_storage)],
    key: Annotated[uuid.UUID, Header(alias="Idempotency-Key")],
    customer_id: Annotated[uuid.UUID, Form()],
    owner_id: Annotated[uuid.UUID, Form()],
    invoice: Annotated[UploadFile, File()],
    order: Annotated[UploadFile | None, File()] = None,
    delivery: Annotated[UploadFile | None, File()] = None,
) -> JSONResponse:
    uploads = [
        f
        for f in [
            await _file("invoice", invoice),
            await _file("order", order),
            await _file("delivery", delivery),
        ]
        if f is not None
    ]
    status, body = await create_package(
        session,
        storage,
        actor_id=member.user_id,
        customer_id=customer_id,
        owner_id=owner_id,
        uploads=uploads,
        key=key,
    )
    return JSONResponse(body, status_code=status)


@router.delete("/packages/{package_id}", status_code=204)
async def delete(package_id: uuid.UUID, session: Session, member: Deleter) -> Response:
    await delete_package(session, actor_id=member.user_id, package_id=package_id)
    return Response(status_code=204)
