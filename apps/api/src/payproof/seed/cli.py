"""`uv run payproof-seed [--reset]` — load fixtures/ into the database in one transaction."""

import argparse
import asyncio
import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.db import get_sessionmaker
from payproof.core.logging import configure_logging
from payproof.core.settings import get_settings
from payproof.repositories import models  # noqa: F401 — registers every table
from payproof.repositories.base import bind_tenant
from payproof.repositories.models import Company
from payproof.repositories.orm import Base
from payproof.seed.audit import audit_rows
from payproof.seed.evidence import evidence_rows
from payproof.seed.extraction import extraction_rows
from payproof.seed.files import store_demo_files
from payproof.seed.identity import COMPANY_ID, identity_rows
from payproof.seed.packages import package_rows
from payproof.seed.workflow import workflow_rows
from payproof.storage.s3 import get_storage

log = logging.getLogger(__name__)


async def reset(session: AsyncSession) -> None:
    """TRUNCATE, not DELETE: requirement_sets and audit_events reject DELETE by trigger."""
    tables = ", ".join(t.name for t in Base.metadata.sorted_tables)
    await session.execute(text(f"TRUNCATE {tables} CASCADE"))


async def seed(session: AsyncSession) -> bool:
    """Insert the demo dataset; False (and no change) if it is already there.
    Ids are derived from fixture slugs, so a seeded database is always identical."""
    if await session.get(Company, COMPANY_ID) is not None:
        return False
    rows = identity_rows() + package_rows() + extraction_rows() + workflow_rows()
    for group in [*rows, evidence_rows(), audit_rows()]:
        session.add_all(group)
        await session.flush()
    return True


async def _main(with_reset: bool) -> None:
    async with get_sessionmaker()() as session, session.begin():
        if with_reset:
            await reset(session)
        created = await seed(session)
        if created:  # before COMMIT: a storage failure leaves no rows without files
            bind_tenant(session, COMPANY_ID)  # the demo dataset is one company
            await store_demo_files(session, get_storage())
    log.info("seed %s", "loaded" if created else "skipped: demo data already present")


def run() -> None:
    parser = argparse.ArgumentParser(prog="payproof-seed", description=__doc__)
    parser.add_argument("--reset", action="store_true", help="truncate all tables first")
    args = parser.parse_args()
    if get_settings().env == "prod":
        raise SystemExit("payproof-seed is for dev/test databases only")
    configure_logging(get_settings().log_level)
    asyncio.run(_main(args.reset))
