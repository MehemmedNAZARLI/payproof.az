"""A new package from a document set (invoice required): stored files, version 1 of each
document, the package PROCESSING until the `create_package` job has extracted them all."""

import datetime as dt
import hashlib
import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.errors import Conflict, ErrorCode, InvalidInput, NotFound
from payproof.core.ids import uuid7
from payproof.extraction.mock import newset_for
from payproof.repositories.models import (
    Customer,
    Document,
    DocumentVersion,
    InvoicePackage,
    Membership,
)
from payproof.services import files, idempotency
from payproof.services.audit import record
from payproof.services.upload import LABEL, clean_name
from payproof.storage.s3 import Storage
from payproof.worker.queue import PostgresQueue

ENDPOINT = "createPackage"


class DuplicateInvoice(Conflict):
    code = ErrorCode.DUPLICATE_INVOICE


@dataclass(frozen=True)
class NewFile:
    doc_type: str  # invoice | order | delivery
    name: str
    data: bytes


async def create_package(
    session: AsyncSession,
    storage: Storage,
    *,
    actor_id: uuid.UUID,
    customer_id: uuid.UUID,
    owner_id: uuid.UUID,
    uploads: list[NewFile],
    key: uuid.UUID,
) -> tuple[int, dict[str, str]]:
    checked = [(f, files.inspect(f.data), clean_name(f.name)) for f in uploads]
    digest = hashlib.sha256(
        f"{customer_id}|{owner_id}|{'|'.join(i.sha256 for _, i, _ in checked)}".encode()
    ).hexdigest()
    if replay := await idempotency.claim(session, endpoint=ENDPOINT, key=key, request_hash=digest):
        return replay.status_code, replay.body
    customer = await session.scalar(select(Customer).where(Customer.id == customer_id))
    if customer is None:
        raise NotFound
    owner = await session.scalar(
        select(Membership.id).where(
            Membership.user_id == owner_id,
            Membership.company_id == customer.company_id,  # memberships are not tenant-guarded
            Membership.active.is_(True),
        )
    )
    if owner is None:
        raise InvalidInput("Məsul şəxs şirkətin üzvü deyil.", {"fields": {"owner_id": "?"}})
    invoice = next(name for f, _, name in checked if f.doc_type == "invoice")
    # shortcut: the invoice number is known up front only for the demo sets (AI_PROVIDER=mock);
    # with real extraction it arrives with the job, and the duplicate check moves there
    demo = newset_for(invoice)
    number = demo["invoice_number"] if demo else None
    if number and await session.scalar(
        select(InvoicePackage.id).where(
            InvoicePackage.customer_id == customer.id,
            InvoicePackage.invoice_number == number,
            InvoicePackage.deleted_at.is_(None),
        )
    ):
        raise DuplicateInvoice(f"{number} bu müştəri üçün artıq mövcuddur.")
    pkg = InvoicePackage(
        company_id=customer.company_id, customer_id=customer.id, owner_id=owner_id,
        invoice_number=number, currency=demo["currency"] if demo else None,
        invoice_date=dt.date.fromisoformat(demo["invoice_date"]) if demo else None,
        processing=True,
    )  # fmt: skip
    session.add(pkg)
    await session.flush()
    await record(
        session, actor_id=actor_id, action="package.created",
        message=f"{number or invoice} · {customer.name}", package=pkg,
    )  # fmt: skip
    for f, info, name in checked:
        doc = Document(company_id=pkg.company_id, package_id=pkg.id, type=f.doc_type)
        session.add(doc)
        await session.flush()
        vid = uuid7()
        storage_key = f"{pkg.company_id}/{pkg.id}/{vid}"
        await storage.put(storage_key, f.data, info.mime)
        session.add(
            DocumentVersion(
                id=vid, company_id=pkg.company_id, document_id=doc.id, version_no=1,
                file_name=name, storage_key=storage_key, sha256=info.sha256, mime=info.mime,
                size=len(f.data), pages=info.pages, source_kind=info.source_kind,
                uploaded_by=actor_id, package_version_at_upload=1,
            )
        )  # fmt: skip
        await session.flush()
        await record(
            session, actor_id=actor_id, action="document.uploaded",
            message=f"{LABEL[f.doc_type]}: {name} (sənəd v1)",
            object_type="document_version", object_id=vid, package=pkg,
        )  # fmt: skip
    job = await PostgresQueue().enqueue(
        session, company_id=pkg.company_id, kind="create_package",
        payload={"package_id": str(pkg.id)},
    )  # fmt: skip
    body = {"job_id": str(job.id), "package_id": str(pkg.id)}
    await idempotency.complete(session, endpoint=ENDPOINT, key=key, status_code=202, body=body)
    await session.commit()
    return 202, body
