import uuid

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, String, Text, UniqueConstraint, true
from sqlalchemy.orm import Mapped, mapped_column

from payproof.domain.enums import Role
from payproof.repositories.orm import Base, IdMixin, TimestampMixin, one_of

VOEN_CHECK = "voen ~ '^[0-9]{10}$'"


class Company(IdMixin, TimestampMixin, Base):
    """The tenant itself."""

    __tablename__ = "companies"
    __table_args__ = (CheckConstraint(VOEN_CHECK, name="voen_format"),)

    name: Mapped[str] = mapped_column(Text)
    voen: Mapped[str] = mapped_column(Text)  # length/format via CHECK
    locale: Mapped[str] = mapped_column(String(8), server_default="az")


class User(IdMixin, TimestampMixin, Base):
    """A person; belongs to companies only through memberships."""

    __tablename__ = "users"
    __table_args__ = (CheckConstraint("email = lower(email)", name="email_lowercase"),)

    email: Mapped[str] = mapped_column(Text, unique=True)
    full_name: Mapped[str] = mapped_column(Text)
    title: Mapped[str] = mapped_column(Text)


class Membership(IdMixin, TimestampMixin, Base):
    """User's role in a company. Not tenant-guarded: it is looked up to *find* the tenant."""

    __tablename__ = "memberships"
    __table_args__ = (
        UniqueConstraint("user_id", "company_id"),
        one_of("role", Role, "role_known"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"), index=True)
    role: Mapped[str] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(Boolean, server_default=true())
