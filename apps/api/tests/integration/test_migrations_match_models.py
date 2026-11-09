from typing import Any

from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext
from sqlalchemy import Connection
from sqlalchemy.ext.asyncio import AsyncEngine

from payproof.repositories import models  # noqa: F401 — registers every table
from payproof.repositories.orm import Base


def _diff(conn: Connection) -> list[Any]:
    return list(compare_metadata(MigrationContext.configure(conn), Base.metadata))


async def test_migrations_match_models(db_engine: AsyncEngine) -> None:
    """A model change without a migration (or the reverse) fails here, not in production."""
    async with db_engine.connect() as conn:
        assert await conn.run_sync(_diff) == []
