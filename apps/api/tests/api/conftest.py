from collections.abc import AsyncIterator, Callable

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.auth import issue_dev_token
from payproof.core.db import get_session
from payproof.core.settings import get_settings
from payproof.main import create_app
from payproof.seed.cli import seed
from payproof.seed.fixtures import uid


@pytest.fixture
async def seeded(db: AsyncSession) -> AsyncSession:
    await seed(db)
    return db


@pytest.fixture
def app(db: AsyncSession) -> FastAPI:
    """Dev app (as `make dev-api`) on the test transaction; a fresh session per request."""
    application = create_app(get_settings().model_copy(update={"env": "dev"}))

    async def session() -> AsyncIterator[AsyncSession]:
        async with AsyncSession(
            bind=await db.connection(),
            join_transaction_mode="create_savepoint",
            expire_on_commit=False,
        ) as s:
            yield s

    application.dependency_overrides[get_session] = session
    return application


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
def auth() -> Callable[[str], dict[str, str]]:
    """Bearer header for a fixture user slug ("u1" operator, "u2" approver, "u5" readonly)."""

    def header(user: str) -> dict[str, str]:
        token, _ = issue_dev_token(uid(user), get_settings().jwt_secret.get_secret_value())
        return {"Authorization": f"Bearer {token}"}

    return header
