import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.errors import IdempotencyKeyReused
from payproof.repositories.base import bind_tenant
from payproof.services import idempotency
from tests.integration.factories import Tenant

H1, H2 = "a" * 64, "b" * 64


async def test_first_call_runs_then_replays(db: AsyncSession, a: Tenant) -> None:
    bind_tenant(db, a.company.id)
    key = uuid.uuid4()
    assert await idempotency.claim(db, endpoint="upload", key=key, request_hash=H1) is None
    await idempotency.complete(db, endpoint="upload", key=key, status_code=202, body={"x": 1})
    replay = await idempotency.claim(db, endpoint="upload", key=key, request_hash=H1)
    assert replay == idempotency.Replay(202, {"x": 1})
    with pytest.raises(IdempotencyKeyReused):
        await idempotency.claim(db, endpoint="upload", key=key, request_hash=H2)
    # the same key on another endpoint is another request
    assert await idempotency.claim(db, endpoint="approve", key=key, request_hash=H2) is None


async def test_keys_are_per_company(db: AsyncSession, a: Tenant, b: Tenant) -> None:
    key = uuid.uuid4()
    bind_tenant(db, a.company.id)
    assert await idempotency.claim(db, endpoint="upload", key=key, request_hash=H1) is None
    other = AsyncSession(bind=await db.connection(), join_transaction_mode="create_savepoint")
    bind_tenant(other, b.company.id)  # a session serves one tenant
    assert await idempotency.claim(other, endpoint="upload", key=key, request_hash=H2) is None
    await other.close()
