from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

PROBE = "select to_regclass('public.rollback_probe') is not null"


async def test_commit_inside_test_is_rolled_back(db: AsyncSession, db_engine: AsyncEngine) -> None:
    await db.execute(text("create table rollback_probe (id int)"))
    await db.commit()
    assert (await db.execute(text(PROBE))).scalar()
    async with db_engine.connect() as other:
        assert not (await other.execute(text(PROBE))).scalar()


async def test_previous_test_left_nothing(db: AsyncSession) -> None:
    assert not (await db.execute(text(PROBE))).scalar()


async def test_test_database_is_separate(db: AsyncSession) -> None:
    name = (await db.execute(text("select current_database()"))).scalar()
    assert isinstance(name, str) and name.endswith("_test")


def test_migrations_go_down_and_up(alembic_cfg: Config) -> None:
    command.downgrade(alembic_cfg, "base")
    command.upgrade(alembic_cfg, "head")
