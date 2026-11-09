import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.models import Company, Membership, User


def _company(voen: str = "1700123451") -> Company:
    return Company(name="A Distribusiya MMC", voen=voen)


def _user(email: str = "aygun@a.test") -> User:
    return User(email=email, full_name="Aygün Məmmədova", title="Maliyyə əməkdaşı")


async def _flush_fails(db: AsyncSession, *objs: object) -> None:
    db.add_all(objs)
    with pytest.raises(IntegrityError):
        await db.flush()


async def test_membership_links_user_and_company(db: AsyncSession) -> None:
    company, user = _company(), _user()
    db.add_all([company, user])
    await db.flush()
    membership = Membership(user_id=user.id, company_id=company.id, role="operator")
    db.add(membership)
    await db.flush()
    assert membership.active is True
    assert company.locale == "az"


async def test_email_is_unique(db: AsyncSession) -> None:
    db.add(_user())
    await db.flush()
    await _flush_fails(db, _user())


async def test_email_must_be_lowercase(db: AsyncSession) -> None:
    await _flush_fails(db, _user("Aygun@A.test"))


async def test_one_membership_per_user_and_company(db: AsyncSession) -> None:
    company, user = _company(), _user()
    db.add_all([company, user])
    await db.flush()
    db.add(Membership(user_id=user.id, company_id=company.id, role="operator"))
    await db.flush()
    await _flush_fails(db, Membership(user_id=user.id, company_id=company.id, role="approver"))


async def test_unknown_role_is_rejected(db: AsyncSession) -> None:
    company, user = _company(), _user()
    db.add_all([company, user])
    await db.flush()
    await _flush_fails(db, Membership(user_id=user.id, company_id=company.id, role="superuser"))


@pytest.mark.parametrize("voen", ["170012345", "17001234511", "17001234AB"])
async def test_company_voen_is_ten_digits(db: AsyncSession, voen: str) -> None:
    await _flush_fails(db, _company(voen))
