"""Who the user is, which demo users exist, and who works in the company."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.auth import issue_dev_token
from payproof.core.errors import InvalidInput, NotFound
from payproof.domain.enums import Role
from payproof.domain.permissions import Permission, can
from payproof.repositories.identity import MembershipRepository, UserRepository
from payproof.repositories.models import Company
from payproof.schemas.auth import CompanyRef, Me, Session, UserRef


async def profile(session: AsyncSession, user_id: uuid.UUID) -> Me:
    membership = await MembershipRepository(session).sign_in(user_id)
    user = await UserRepository(session).get(user_id)
    if membership is None or user is None:
        raise NotFound
    company = await session.get(Company, membership.company_id)
    if company is None:
        raise NotFound
    role = Role(membership.role)
    return Me(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        title=user.title,
        role=role,
        company=CompanyRef(id=company.id, name=company.name, voen=company.voen),
        permissions=[p for p in Permission if can(role, p)],  # matrix order, like the mock
    )


async def dev_users(session: AsyncSession) -> list[UserRef]:
    """Everyone who may sign in (ADR-0008: assignees are not offered)."""
    rows = await MembershipRepository(session).sign_in_candidates()
    return [_ref(user.id, user.full_name, user.title, role) for user, role in rows]


async def dev_login(session: AsyncSession, user_id: uuid.UUID, secret: str) -> Session:
    if await MembershipRepository(session).sign_in(user_id) is None:
        raise InvalidInput(
            "Demo istifadəçi tapılmadı.", details={"fields": {"user_id": "Naməlum istifadəçi."}}
        )
    token, expires_in = issue_dev_token(user_id, secret)
    return Session(access_token=token, expires_in=expires_in, user=await profile(session, user_id))


async def members(
    session: AsyncSession, company_id: uuid.UUID, *, assignable: bool
) -> list[UserRef]:
    """Active members; `assignable` (task assignee / package owner) excludes read-only users."""
    exclude = frozenset({Role.READONLY}) if assignable else frozenset()
    rows = await MembershipRepository(session).members(company_id, exclude=exclude)
    return [_ref(user.id, user.full_name, user.title, role) for user, role in rows]


def _ref(id_: uuid.UUID, full_name: str, title: str, role: Role) -> UserRef:
    return UserRef(id=id_, full_name=full_name, title=title, role=role)
