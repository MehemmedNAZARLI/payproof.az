"""In-app notifications: one row per recipient, plus a live `notification.created` event so the
bell updates without a refresh (ADR-0010). Sent in the writing transaction — only on commit."""

import uuid
from collections.abc import Iterable

from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.models import InvoicePackage, Notification
from payproof.services import events


async def notify(
    session: AsyncSession, pkg: InvoicePackage, user_ids: Iterable[uuid.UUID], text: str
) -> list[Notification]:
    rows = [
        Notification(company_id=pkg.company_id, user_id=u, package_id=pkg.id, text=text)
        for u in dict.fromkeys(user_ids)  # one per person, order kept
    ]
    session.add_all(rows)
    await session.flush()
    for n in rows:
        await events.notify(
            session,
            {
                "event_id": str(n.id),
                "company_id": str(pkg.company_id),
                "type": events.LiveEventType.NOTIFICATION_CREATED.value,
                "package_id": str(pkg.id),
                "package_version": pkg.version,
                "actor_id": None,
                "at": n.created_at.isoformat().replace("+00:00", "Z"),
            },
        )
    return rows
