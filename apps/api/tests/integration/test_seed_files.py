import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.base import bind_tenant
from payproof.repositories.models import DocumentVersion
from payproof.seed.cli import seed
from payproof.seed.files import placeholder, store_placeholders
from payproof.seed.identity import COMPANY_ID
from payproof.services.files import inspect
from payproof.storage.s3 import get_storage


@pytest.mark.parametrize("name", ["a.pdf", "b.jpg", "c.png", "d.csv", "e.xlsx"])
def test_placeholders_pass_the_upload_check(name: str) -> None:
    inspect(placeholder(name))  # raises if the content is not what the extension says


async def test_seeded_sizes_are_the_stored_bytes(db: AsyncSession) -> None:
    await seed(db)
    bind_tenant(db, COMPANY_ID)
    versions = (await db.scalars(select(DocumentVersion))).all()
    assert versions and all(v.size == len(placeholder(v.file_name)) > 1 for v in versions)
    one = versions[0]
    await store_placeholders(get_storage(), [one])
    assert await get_storage().get(one.storage_key) == placeholder(one.file_name)
