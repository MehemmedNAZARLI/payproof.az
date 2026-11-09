"""Audit log pages and CSV export (newest first)."""

import datetime as dt

from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.paging import decode_cursor, encode_cursor
from payproof.repositories.audit_reads import SYSTEM_NAME, AuditFilter, AuditRow, search
from payproof.schemas import audit as s
from payproof.schemas.auth import UserRef
from payproof.schemas.packages import PackageRef

CSV_HEADER = ("created_at", "actor", "action", "invoice_number", "package_version", "message")


def _event(r: AuditRow) -> s.AuditEvent:
    e = r.event
    actor = (
        UserRef(id=r.actor.id, full_name=r.actor.full_name, title=r.actor.title, role=r.actor_role)
        if r.actor and r.actor_role
        else None
    )
    return s.AuditEvent(
        id=e.id,
        created_at=e.created_at,
        actor=actor,
        action=e.action,
        message=e.message,
        package=PackageRef(id=e.package_id, invoice_number=r.invoice_number or "")
        if e.package_id
        else None,
        package_version=e.package_version,
        object_type=e.object_type,
        object_id=e.object_id,
        details=dict(e.detail),
    )


async def audit_page(
    session: AsyncSession, f: AuditFilter, *, limit: int, cursor: str | None
) -> s.AuditPage:
    start = decode_cursor(cursor)
    rows = await search(session, f, offset=start, limit=limit + 1)  # one extra = more pages
    return s.AuditPage(
        items=[_event(r) for r in rows[:limit]],
        next_cursor=encode_cursor(start + limit) if len(rows) > limit else None,
    )


def _cell(value: object) -> str:
    text = "" if value is None else str(value)
    if text.startswith(("=", "+", "-", "@", "\t", "\r")):  # Excel would run it as a formula
        text = "'" + text
    return '"' + text.replace('"', '""') + '"'


def _utc(at: dt.datetime) -> str:
    return at.astimezone(dt.UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


async def audit_csv(session: AsyncSession, f: AuditFilter) -> str:
    """Whole filtered log. UTF-8 BOM + CRLF + every cell quoted, so Excel opens Azerbaijani
    text and commas correctly."""
    rows = await search(session, f)
    lines = [",".join(CSV_HEADER)]
    for r in rows:
        e = r.event
        who = r.actor.full_name if r.actor else SYSTEM_NAME
        cells = (_utc(e.created_at), who, e.action, r.invoice_number, e.package_version, e.message)
        lines.append(",".join(_cell(c) for c in cells))
    return "﻿" + "\r\n".join(lines) + "\r\n"
