"""E-mail submission of an export (ADR-0011 §4): the zip goes only to the requirement set's
address, through Resend (`RESEND_API_KEY`). A background job (`send_export`): retried, idempotent
per export (Resend `Idempotency-Key`), and a failure never undoes the export. Without a key,
dev/test log that the message would have been sent; prod marks it FAILED.

Logs and audit carry ids, the address and the status — never the attachment or document text."""

import base64
import datetime as dt
import logging
import uuid
from typing import Any

import httpx2
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.settings import Settings, get_settings
from payproof.repositories.models import ExportRecord, InvoicePackage, Job
from payproof.services.audit import record
from payproof.storage.s3 import Storage

log = logging.getLogger(__name__)


class SubmissionFailed(RuntimeError):
    """Resend refused or could not be reached; the job retries, then the status is FAILED."""


async def send_via_resend(
    settings: Settings, *, export_id: uuid.UUID, to: str, subject: str, text: str,
    attachment: tuple[str, bytes], client: httpx2.AsyncClient | None = None,
) -> str | None:  # fmt: skip
    """The provider message id, or None when there is no key (dev/test: logged only)."""
    if settings.resend_api_key is None:
        if settings.env == "prod":
            raise SubmissionFailed("RESEND_API_KEY is not set")
        log.info("export %s: e-mail to %s not sent (no RESEND_API_KEY, %s)", export_id, to,
                 settings.env)  # fmt: skip
        return None
    name, data = attachment
    files = [{"filename": name, "content": base64.b64encode(data).decode()}]
    body = {"from": settings.resend_from, "to": [to], "subject": subject, "text": text,
            "attachments": files}  # fmt: skip
    headers = {"Authorization": f"Bearer {settings.resend_api_key.get_secret_value()}",
               "Idempotency-Key": f"export-{export_id}"}  # a retry never sends twice  # fmt: skip
    own = client is None
    http = client or httpx2.AsyncClient(base_url=settings.resend_base_url, timeout=30.0)
    try:
        r = await http.post("/emails", json=body, headers=headers)
    except httpx2.HTTPError as e:
        raise SubmissionFailed(type(e).__name__) from e
    finally:
        if own:
            await http.aclose()
    if r.status_code >= 300:
        raise SubmissionFailed(f"resend status {r.status_code}")
    message_id: Any = r.json().get("id")
    return str(message_id) if message_id else None


def _status(rec: ExportRecord, status: str) -> None:
    out = dict(rec.output or {})
    out["submission"] = {**out.get("submission", {}), "status": status,
                         "attempted_at": dt.datetime.now(dt.UTC).isoformat()}  # fmt: skip
    rec.output = out  # reassigned: JSONB change tracking


async def send_export(
    s: AsyncSession, storage: Storage, job: Job, client: httpx2.AsyncClient | None = None
) -> dict[str, Any]:
    rec = await s.get_one(ExportRecord, uuid.UUID(job.payload["export_id"]))
    pkg = await s.get_one(InvoicePackage, rec.package_id)
    sub = (rec.output or {}).get("submission") or {}
    if sub.get("status") == "SENT":
        return {"export_id": str(rec.id), "status": "SENT"}  # already delivered: idempotent
    zip_name = f"{pkg.reference or pkg.invoice_number}_v{rec.package_version}.zip"
    data = await storage.get(rec.manifest_key.rsplit("/", 1)[0] + "/package.zip")
    settings = get_settings()
    message_id = await send_via_resend(
        settings, export_id=rec.id, to=sub["address"], attachment=(zip_name, data),
        subject=f"{pkg.reference}: hesabat paketi (v{rec.package_version})",
        text="Paket göndərilməyə hazırdır. Bu, ödəniş təsdiqi deyil. Əlavədə paket və manifest.",
        client=client,
    )  # fmt: skip
    _status(rec, "SENT")
    how = "Resend" if message_id else f"{settings.env}: göndərilmədi, yalnız log"
    await record(
        s, actor_id=None, action="export.sent", object_type="export", object_id=rec.id,
        package=pkg, message=f"{zip_name} → {sub['address']} ({how})",
        detail={"address": sub["address"], "provider_message_id": message_id},
    )  # fmt: skip
    return {"export_id": str(rec.id), "status": "SENT"}


async def send_failed(s: AsyncSession, job: Job) -> None:
    rec = await s.get_one(ExportRecord, uuid.UUID(job.payload["export_id"]))
    pkg = await s.get_one(InvoicePackage, rec.package_id)
    _status(rec, "FAILED")
    address = ((rec.output or {}).get("submission") or {}).get("address")
    await record(
        s, actor_id=None, action="export.send_failed", object_type="export", object_id=rec.id,
        package=pkg, message=f"Göndərmə alınmadı → {address}; ixrac qüvvədədir",
    )  # fmt: skip
