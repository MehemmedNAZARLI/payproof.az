"""`Idempotency-Key` (openapi IdempotencyKey): a retry gets the first response, no new event."""

import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.errors import Conflict, ErrorCode, IdempotencyKeyReused
from payproof.repositories.base import TENANT_KEY
from payproof.repositories.models import IdempotencyKey


class IdempotencyInProgress(Conflict):
    code = ErrorCode.IDEMPOTENCY_IN_PROGRESS
    message = "Eyni sorğu hələ emal olunur."


@dataclass(frozen=True)
class Replay:
    status_code: int
    body: dict[str, Any]


async def claim(
    session: AsyncSession, *, endpoint: str, key: uuid.UUID, request_hash: str
) -> Replay | None:
    """None = first time: go on, then `complete()` in the same transaction. The row is inserted
    in that transaction, so a concurrent request with the same key waits on the unique index
    until this one commits (then replays) or rolls back (then runs itself)."""
    try:
        async with session.begin_nested():  # a lost race undoes only this insert
            session.add(
                IdempotencyKey(
                    company_id=session.info[TENANT_KEY],
                    endpoint=endpoint,
                    key=str(key),
                    request_hash=request_hash,
                )
            )
        return None
    except IntegrityError:
        pass
    row = await _row(session, endpoint, key)
    if row.request_hash != request_hash:
        raise IdempotencyKeyReused
    if row.status_code is None or row.response is None:
        raise IdempotencyInProgress  # committed without a response: not written by this module
    return Replay(row.status_code, row.response)


async def complete(
    session: AsyncSession, *, endpoint: str, key: uuid.UUID, status_code: int, body: dict[str, Any]
) -> None:
    row = await _row(session, endpoint, key)
    row.status_code, row.response = status_code, body
    await session.flush()


async def _row(session: AsyncSession, endpoint: str, key: uuid.UUID) -> IdempotencyKey:
    return (
        await session.scalars(
            select(IdempotencyKey).where(
                IdempotencyKey.endpoint == endpoint, IdempotencyKey.key == str(key)
            )
        )
    ).one()
