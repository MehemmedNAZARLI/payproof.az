"""Customer output templates (approver only): stored once per content, referenced by sha256."""

import hashlib
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.errors import FileTooLarge, InvalidInput, NotFound
from payproof.repositories.models import Customer, OutputTemplate
from payproof.services.audit import record
from payproof.services.docx import placeholders
from payproof.storage.s3 import Storage

MAX_BYTES = 20 * 1024 * 1024
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


async def upload_template(
    session: AsyncSession,
    storage: Storage,
    *,
    actor_id: uuid.UUID,
    customer_id: uuid.UUID,
    file_name: str,
    data: bytes,
) -> OutputTemplate:
    customer = await session.scalar(select(Customer).where(Customer.id == customer_id))
    if customer is None:
        raise NotFound
    if len(data) > MAX_BYTES:
        raise FileTooLarge
    if not file_name.lower().endswith(".docx"):
        raise InvalidInput("Fayl adı .docx ilə bitməlidir.", {"fields": {"file": ".docx"}})
    found = placeholders(data)
    if not found:
        raise InvalidInput("Şablonda {{placeholder}} yoxdur.", {"fields": {"file": "boş şablon"}})
    sha = hashlib.sha256(data).hexdigest()
    existing = await session.scalar(
        select(OutputTemplate).where(
            OutputTemplate.customer_id == customer.id, OutputTemplate.sha256 == sha
        )
    )
    if existing is not None:
        return existing  # same content: no new row, no new audit event
    t = OutputTemplate(
        company_id=customer.company_id, customer_id=customer.id, file_name=file_name,
        sha256=sha, size=len(data), storage_key=f"templates/{customer.id}/{sha}.docx",
        placeholders=found, uploaded_by=actor_id,
    )  # fmt: skip
    await storage.put(t.storage_key, data, DOCX)
    session.add(t)
    await session.flush()
    await record(
        session, actor_id=actor_id, action="output_template.uploaded",
        message=f"{customer.name}: çıxış şablonu yükləndi — {file_name} ({len(found)} sahə)",
        object_type="output_template", object_id=t.id,
    )  # fmt: skip
    await session.commit()
    return t


async def find(session: AsyncSession, customer_id: uuid.UUID, sha256: str) -> OutputTemplate | None:
    return await session.scalar(
        select(OutputTemplate).where(
            OutputTemplate.customer_id == customer_id, OutputTemplate.sha256 == sha256
        )
    )
