import os

# CI provides these; locally fall back to non-secret test values.
# DATABASE_URL and S3_* have no default: they come from CI or the repo .env, so tests reach the
# same Postgres and MinIO as `make up` (local ports and credentials vary).
os.environ.setdefault("ENV", "test")
os.environ.setdefault("JWT_SECRET", "test-only-not-a-secret-32-bytes-min")
os.environ.setdefault("AI_PROVIDER", "mock")

import asyncio
from collections.abc import AsyncIterator, Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from payproof.core.settings import get_settings

ALEMBIC_INI = Path(__file__).parents[1] / "alembic.ini"


def alembic_config(url: str) -> Config:
    cfg = Config(ALEMBIC_INI)
    cfg.set_main_option("sqlalchemy.url", url.replace("%", "%%"))  # configparser interpolation
    cfg.attributes["configure_logging"] = False
    return cfg


async def _recreate_database(url: str) -> None:
    target = make_url(url)
    admin = create_async_engine(
        target.set(database="postgres"), isolation_level="AUTOCOMMIT", poolclass=NullPool
    )
    async with admin.connect() as conn:
        await conn.execute(text(f'DROP DATABASE IF EXISTS "{target.database}" WITH (FORCE)'))
        await conn.execute(text(f'CREATE DATABASE "{target.database}"'))
    await admin.dispose()


@pytest.fixture(scope="session")
def test_db_url() -> Iterator[str]:
    """Fresh `<db>_test` database migrated to head; dev data is never touched."""
    base = make_url(get_settings().database_url)
    url = base.set(database=f"{base.database}_test").render_as_string(hide_password=False)
    asyncio.run(_recreate_database(url))  # sync fixture: no event loop is running yet
    command.upgrade(alembic_config(url), "head")
    yield url


@pytest.fixture
def alembic_cfg(test_db_url: str) -> Config:
    return alembic_config(test_db_url)


@pytest.fixture(scope="session")
async def db_engine(test_db_url: str) -> AsyncIterator[AsyncEngine]:
    engine = create_async_engine(test_db_url)
    yield engine
    await engine.dispose()


@pytest.fixture
async def db(db_engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    """Session in an outer transaction that is rolled back; `commit()` releases a savepoint."""
    async with db_engine.connect() as conn:
        outer = await conn.begin()
        session = AsyncSession(
            bind=conn, join_transaction_mode="create_savepoint", expire_on_commit=False
        )
        yield session
        await session.close()
        await outer.rollback()
