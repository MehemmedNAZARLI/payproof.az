"""Append-only audit trail (security.md): who did what to which object of which package
version, with the request's correlation id. Called by every write service, in its transaction."""

import datetime as dt
import uuid
from collections.abc import Mapping
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.logging import correlation_id
from payproof.repositories.base import TENANT_KEY, TenantContextMissing
from payproof.repositories.models import AuditEvent, InvoicePackage
from payproof.services import events


async def record(
    session: AsyncSession,
    *,
    actor_id: uuid.UUID | None,  # None = system
    action: str,  # "package.approved"
    message: str,  # Azerbaijani summary; never document text
    object_type: str = "package",
    object_id: uuid.UUID | None = None,
    package: InvoicePackage | None = None,
    detail: Mapping[str, Any] | None = None,
    company_id: uuid.UUID | None = None,  # only for unbound system sessions (seed, worker)
    at: dt.datetime | None = None,  # history replay (seed); default: now
) -> AuditEvent:
    tenant = company_id or session.info.get(TENANT_KEY)
    if tenant is None:
        raise TenantContextMissing("audit event without a tenant")
    event = AuditEvent(
        company_id=tenant,
        actor_id=actor_id,
        action=action,
        message=message,
        object_type=object_type,
        object_id=object_id,
        package_id=package.id if package else None,
        package_version=package.version if package else None,
        detail=dict(detail or {}),
        correlation_id=correlation_id.get(),
        created_at=at,
    )
    session.add(event)
    await session.flush()  # id + created_at now: the live event carries them
    await events.publish(session, event)  # same transaction: sent only if this commits
    return event
