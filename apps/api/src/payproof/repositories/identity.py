import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.domain.enums import Role
from payproof.repositories.models import Membership, User


class UserRepository:
    """Users are global (one person, many companies), so no tenant scope."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def by_email(self, email: str) -> User | None:
        result = await self.session.execute(select(User).where(User.email == email.strip().lower()))
        return result.scalar_one_or_none()

    async def get(self, user_id: uuid.UUID) -> User | None:
        return await self.session.get(User, user_id)


class MembershipRepository:
    """Resolves the tenant for a user, so it runs before `bind_tenant`."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def active(self, user_id: uuid.UUID, company_id: uuid.UUID) -> Membership | None:
        result = await self.session.execute(
            select(Membership).where(
                Membership.user_id == user_id,
                Membership.company_id == company_id,
                Membership.active.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def sign_in(self, user_id: uuid.UUID) -> Membership | None:
        """The membership a token acts under: active and allowed to sign in (not `assignee`,
        ADR-0008). shortcut: a user in several companies gets None until a company switch
        (P1) lets the client choose."""
        result = await self.session.execute(
            select(Membership).where(
                Membership.user_id == user_id,
                Membership.active.is_(True),
                Membership.role != Role.ASSIGNEE,
            )
        )
        found = result.scalars().all()
        return found[0] if len(found) == 1 else None

    async def sign_in_candidates(self) -> list[tuple[User, Role]]:
        """Users with an active membership that may sign in (dev login picker)."""
        result = await self.session.execute(
            select(User, Membership.role)
            .join(Membership, Membership.user_id == User.id)
            .where(Membership.active.is_(True), Membership.role != Role.ASSIGNEE)
            .order_by(User.full_name)
        )
        return [(user, Role(role)) for user, role in result.all()]

    async def members(
        self, company_id: uuid.UUID, *, exclude: frozenset[Role] = frozenset()
    ) -> list[tuple[User, Role]]:
        """Active members of a company with their role, by name."""
        result = await self.session.execute(
            select(User, Membership.role)
            .join(Membership, Membership.user_id == User.id)
            .where(
                Membership.company_id == company_id,
                Membership.active.is_(True),
                Membership.role.not_in(exclude),
            )
            .order_by(User.full_name)
        )
        return [(user, Role(role)) for user, role in result.all()]
