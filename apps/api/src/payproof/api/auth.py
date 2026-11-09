"""Dev login (ENV=dev only), current user and company members."""

from typing import Annotated

from fastapi import APIRouter, Depends

from payproof.api.deps import CurrentMember, Member, Session, require
from payproof.api.ratelimit import LOGINS
from payproof.core.settings import get_settings
from payproof.domain.permissions import Permission
from payproof.schemas import auth as s
from payproof.services import identity

dev_router = APIRouter(tags=["auth"])
router = APIRouter()


@dev_router.get("/auth/dev-users", response_model=s.UserList)
async def list_dev_users(session: Session) -> s.UserList:
    return s.UserList(items=await identity.dev_users(session))


@dev_router.post("/auth/dev-login", response_model=s.Session, dependencies=[Depends(LOGINS)])
async def dev_login(body: s.DevLoginRequest, session: Session) -> s.Session:
    secret = get_settings().jwt_secret.get_secret_value()
    return await identity.dev_login(session, body.user_id, secret)


@router.get("/me", response_model=s.Me, tags=["auth"])
async def get_me(member: CurrentMember, session: Session) -> s.Me:
    return await identity.profile(session, member.user_id)


@router.get("/users", response_model=s.UserList, tags=["users"])
async def list_users(
    session: Session,
    member: Annotated[Member, Depends(require(Permission.VIEW))],
    assignable: bool = False,
) -> s.UserList:
    return s.UserList(
        items=await identity.members(session, member.company_id, assignable=assignable)
    )
