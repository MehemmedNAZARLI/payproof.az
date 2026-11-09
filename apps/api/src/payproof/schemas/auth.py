"""HTTP shapes of the auth and users endpoints (openapi: DevUser, UserRef, Me, Session)."""

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict

from payproof.domain.enums import Role
from payproof.domain.permissions import Permission


class UserRef(BaseModel):
    """Also the DevUser shape (same fields)."""

    id: uuid.UUID
    full_name: str
    title: str
    role: Role


class UserList(BaseModel):
    items: list[UserRef]


class CompanyRef(BaseModel):
    id: uuid.UUID
    name: str
    voen: str


class Me(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    title: str
    role: Role
    company: CompanyRef
    permissions: list[Permission]


class Session(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"  # noqa: S105 — OAuth token type, not a secret
    expires_in: int
    user: Me


class DevLoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: uuid.UUID
