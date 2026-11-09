"""HTTP shapes of the audit endpoints (openapi: AuditEvent, AuditPage)."""

import datetime as dt
import uuid
from typing import Any

from pydantic import BaseModel

from payproof.schemas.auth import UserRef
from payproof.schemas.packages import PackageRef


class AuditEvent(BaseModel):
    id: uuid.UUID
    created_at: dt.datetime
    actor: UserRef | None  # null = system
    action: str
    message: str
    package: PackageRef | None
    package_version: int | None
    object_type: str
    object_id: uuid.UUID | None
    details: dict[str, Any]


class AuditPage(BaseModel):
    items: list[AuditEvent]
    next_cursor: str | None
