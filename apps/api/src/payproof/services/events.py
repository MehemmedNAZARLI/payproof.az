"""Live events (ADR-0010): a NOTIFY in the writing transaction, delivered only after COMMIT.
IDs only — clients refetch over REST with their own permissions."""

import json
from enum import StrEnum
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.models import AuditEvent

CHANNEL = "payproof_events"


class LiveEventType(StrEnum):
    """Mirror of `LiveEventType` in packages/contracts/openapi.yaml."""

    PACKAGE_CREATED = "package.created"
    PACKAGE_UPDATED = "package.updated"
    PACKAGE_APPROVED = "package.approved"
    PACKAGE_EXPORTED = "package.exported"
    PACKAGE_DELETED = "package.deleted"
    TASK_CHANGED = "task.changed"
    NOTIFICATION_CREATED = "notification.created"
    REQUIREMENTS_CHANGED = "requirements.changed"


_EXACT = {  # same table as packages/mocks/src/events.ts
    "package.created": LiveEventType.PACKAGE_CREATED,
    "package.deleted": LiveEventType.PACKAGE_DELETED,
    "approval.created": LiveEventType.PACKAGE_APPROVED,
    "export.created": LiveEventType.PACKAGE_EXPORTED,
    "requirements.updated": LiveEventType.REQUIREMENTS_CHANGED,
}


def event_type(action: str) -> LiveEventType:
    """Audit action → event type; every other action (document, field, link, …) is an update."""
    if action in _EXACT:
        return _EXACT[action]
    return (
        LiveEventType.TASK_CHANGED if action.startswith("task.") else LiveEventType.PACKAGE_UPDATED
    )


def _id(value: object) -> str | None:
    return None if value is None else str(value)


def live_event(e: AuditEvent) -> dict[str, Any]:
    return {
        "event_id": str(e.id),
        "company_id": str(e.company_id),
        "type": event_type(e.action).value,
        "package_id": _id(e.package_id),
        "package_version": e.package_version,
        "actor_id": _id(e.actor_id),
        "at": e.created_at.isoformat().replace("+00:00", "Z"),
    }


async def notify(session: AsyncSession, payload: dict[str, Any]) -> None:
    # pg_notify (not NOTIFY ...): the payload is a bound parameter; Postgres holds it until COMMIT
    await session.execute(select(func.pg_notify(CHANNEL, json.dumps(payload))))


async def publish(session: AsyncSession, event: AuditEvent) -> None:
    await notify(session, live_event(event))
