import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

import pytest
from sqlalchemy import Column, Table, Uuid, exists, func, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from payproof.repositories.base import (
    BaseRepository,
    TenantContextMissing,
    TenantViolation,
    bind_tenant,
)
from payproof.repositories.models import Company
from payproof.repositories.orm import TenantEntity


class _TestBase(DeclarativeBase):
    """Own registry: test tables never reach the app metadata or migrations."""


# FK target only, so `widgets.company_id -> companies.id` resolves; the real table is migrated
Table("companies", _TestBase.metadata, Column("id", Uuid, primary_key=True))


class Widget(TenantEntity, _TestBase):
    __tablename__ = "widgets"
    name: Mapped[str] = mapped_column()


class WidgetRepository(BaseRepository[Widget]):
    model = Widget


@dataclass
class World:
    a: uuid.UUID
    b: uuid.UUID
    b_widget: uuid.UUID


@pytest.fixture
async def world(db: AsyncSession) -> AsyncIterator[World]:
    widgets = _TestBase.metadata.tables["widgets"]
    # rolled back with the test
    await db.run_sync(lambda s: _TestBase.metadata.create_all(s.connection(), tables=[widgets]))
    a, b = Company(name="A", voen="1700123451"), Company(name="B", voen="1700123452")
    db.add_all([a, b])
    await db.flush()
    b_widget = Widget(name="b-1", company_id=b.id)
    db.add_all([Widget(name="a-1", company_id=a.id), b_widget])
    await db.flush()
    db.expunge_all()
    yield World(a.id, b.id, b_widget.id)


async def _names_as(db: AsyncSession, tenant: uuid.UUID) -> list[str]:
    """Fresh session on the same transaction: one tenant per session, like a request."""
    other = AsyncSession(bind=await db.connection(), join_transaction_mode="create_savepoint")
    bind_tenant(other, tenant)
    return sorted((await other.scalars(select(Widget.name))).all())


@pytest.mark.parametrize(
    "stmt",
    [
        select(Widget),
        select(func.count()).select_from(Widget),
        select(Company.id).join(Widget, Widget.company_id == Company.id),
        select(Company.id).where(exists().where(Widget.company_id == Company.id)),
        update(Widget).values(name="x"),
    ],
    ids=["entity", "select_from", "join", "exists", "update"],
)
async def test_query_without_tenant_context_fails(
    db: AsyncSession, world: World, stmt: Any
) -> None:
    with pytest.raises(TenantContextMissing):
        await db.execute(stmt)


async def test_non_tenant_table_needs_no_context(db: AsyncSession, world: World) -> None:
    assert len((await db.scalars(select(Company.id))).all()) == 2


async def test_repository_requires_tenant_context(db: AsyncSession, world: World) -> None:
    with pytest.raises(TenantContextMissing):
        WidgetRepository(db)


async def test_any_orm_select_is_scoped_to_tenant(db: AsyncSession, world: World) -> None:
    bind_tenant(db, world.a)
    names = (await db.scalars(select(Widget.name))).all()
    assert names == ["a-1"]


async def test_other_tenant_object_is_not_found(db: AsyncSession, world: World) -> None:
    bind_tenant(db, world.a)
    assert await WidgetRepository(db).get(world.b_widget) is None


async def test_add_forces_session_tenant(db: AsyncSession, world: World) -> None:
    bind_tenant(db, world.a)
    widget = WidgetRepository(db).add(Widget(name="sneaky", company_id=world.b))
    await db.flush()
    assert widget.company_id == world.a


async def test_bulk_update_is_scoped_to_tenant(db: AsyncSession, world: World) -> None:
    bind_tenant(db, world.a)
    await db.execute(update(Widget).values(name="changed"))
    assert await _names_as(db, world.b) == ["b-1"]


async def test_session_add_into_other_tenant_fails(db: AsyncSession, world: World) -> None:
    bind_tenant(db, world.a)
    db.add(Widget(name="y", company_id=world.b))
    with pytest.raises(TenantViolation):
        await db.flush()


async def test_session_add_without_company_gets_session_tenant(
    db: AsyncSession, world: World
) -> None:
    bind_tenant(db, world.a)
    widget = Widget(name="y")
    db.add(widget)
    await db.flush()
    assert widget.company_id == world.a


async def test_moving_row_to_other_tenant_fails(db: AsyncSession, world: World) -> None:
    bind_tenant(db, world.a)
    widget = (await db.scalars(select(Widget))).one()
    widget.company_id = world.b
    with pytest.raises(TenantViolation):
        await db.flush()


async def test_bulk_insert_on_tenant_table_fails(db: AsyncSession, world: World) -> None:
    bind_tenant(db, world.a)
    with pytest.raises(TenantViolation):
        await db.execute(insert(Widget).values(name="x", company_id=world.b))


async def test_rebinding_to_other_tenant_fails(db: AsyncSession, world: World) -> None:
    bind_tenant(db, world.a)
    bind_tenant(db, world.a)  # idempotent
    with pytest.raises(TenantViolation):
        bind_tenant(db, world.b)
