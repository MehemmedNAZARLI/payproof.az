import asyncio

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from payproof.core.logging import configure_logging
from payproof.core.settings import get_settings
from payproof.repositories import models  # noqa: F401 — registers tables on Base.metadata
from payproof.repositories.orm import Base

config = context.config
# tests pass their own URL; otherwise use the app settings
url = config.get_main_option("sqlalchemy.url") or get_settings().database_url
if config.attributes.get("configure_logging", True):
    configure_logging(get_settings().log_level)


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=Base.metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    engine = create_async_engine(url, poolclass=pool.NullPool)
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    # shortcut: no `--sql` (offline) mode; add it if DBAs need SQL scripts
    raise SystemExit("offline migrations are not supported; run against a database")
asyncio.run(run_async_migrations())
