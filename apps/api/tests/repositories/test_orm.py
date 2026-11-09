from sqlalchemy import DateTime, Uuid
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from payproof.core.ids import uuid7
from payproof.repositories.orm import Base, IdMixin, TenantMixin, TimestampMixin


class _TestBase(DeclarativeBase):
    """Separate registry so test tables never leak into the app metadata."""


class Widget(IdMixin, TimestampMixin, TenantMixin, _TestBase):
    __tablename__ = "test_orm_widgets"
    name: Mapped[str] = mapped_column()


def test_id_defaults_to_uuid7() -> None:
    col = Widget.__table__.c.id
    assert col.primary_key
    assert isinstance(col.type, Uuid)
    assert col.default is not None and col.default.arg.__name__ == uuid7.__name__


def test_timestamps_are_timezone_aware_and_server_set() -> None:
    for name in ("created_at", "updated_at"):
        col = Widget.__table__.c[name]
        assert isinstance(col.type, DateTime) and col.type.timezone
        assert not col.nullable and col.server_default is not None
    assert Widget.__table__.c.updated_at.onupdate is not None


def test_tenant_column_is_required_indexed_fk_to_companies() -> None:
    col = Widget.__table__.c.company_id
    assert not col.nullable and col.index
    assert [fk.target_fullname for fk in col.foreign_keys] == ["companies.id"]


def test_constraint_naming_convention() -> None:
    fk = Base.metadata.naming_convention["fk"]
    assert fk == "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s"
