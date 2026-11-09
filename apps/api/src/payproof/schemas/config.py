"""ADR-0011 configuration shapes (openapi: DocumentRequirement, CheckConfig, OutputConfig, …)."""

import datetime as dt
import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from payproof.schemas.auth import UserRef

TYPE_KEY = r"^[a-z][a-z0-9_]{1,39}$"
RULE_ID = r"^[A-Z]{1,4}-[0-9]{2,3}$"
EMAIL = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class DocumentRequirementIn(_Strict):
    type: str = Field(pattern=TYPE_KEY)
    min_count: int = Field(ge=0)
    max_count: int | None = Field(ge=1)


class DocumentRequirement(DocumentRequirementIn):
    name: str


class CheckConfig(_Strict):
    id: str = Field(pattern=RULE_ID)
    type: str = Field(min_length=1)
    title: str = Field(min_length=1, max_length=200)
    parameters: dict[str, Any]


class PlaceholderSource(_Strict):
    kind: Literal["field", "aggregate", "approval", "package"]
    document_type: str | None = Field(default=None, pattern=TYPE_KEY)
    field: str | None = None
    op: Literal["sum", "count"] | None = None
    value: Literal["approver_name", "approved_on", "reference"] | None = None


class PlaceholderMapping(_Strict):
    placeholder: str = Field(pattern=r"^\{\{[a-z][a-z0-9_]*\}\}$")
    source: PlaceholderSource


class TemplateRef(_Strict):
    file_name: str = Field(pattern=r"\.docx$")
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")


class Submission(_Strict):
    channel: Literal["email"]
    address: str = Field(pattern=EMAIL, max_length=254)


class OutputConfig(_Strict):
    template: TemplateRef
    placeholders: list[PlaceholderMapping] = Field(min_length=1)
    submission: Submission


class OutputTemplate(BaseModel):
    id: uuid.UUID
    file_name: str
    sha256: str
    size: int
    placeholders: list[str]
    uploaded_by: UserRef
    created_at: dt.datetime


class DocumentTypeInfo(BaseModel):
    key: str
    name: str
    version: int
    builtin: bool
    accepted_formats: list[str]
    extraction: dict[str, Any]


class DocumentTypes(BaseModel):
    items: list[DocumentTypeInfo]


class CheckLibrary(BaseModel):
    families: list[dict[str, Any]]
    legacy_rules: list[dict[str, Any]]
