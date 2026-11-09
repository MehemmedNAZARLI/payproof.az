import datetime as dt
import uuid

from pydantic import BaseModel


class JobAccepted(BaseModel):
    job_id: uuid.UUID
    package_id: uuid.UUID
    document_id: uuid.UUID
    document_version_id: uuid.UUID


class SignedUrl(BaseModel):
    url: str
    expires_at: dt.datetime
