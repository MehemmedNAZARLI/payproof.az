from collections.abc import Callable

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.base import bind_tenant
from payproof.repositories.models import ExportRecord, InvoicePackage
from payproof.seed.files import store_demo_files
from payproof.seed.fixtures import uid
from payproof.seed.identity import COMPANY_ID
from payproof.storage.s3 import get_storage
from tests.api.test_contract import assert_matches

Auth = Callable[[str], dict[str, str]]


async def test_seeded_export_downloads_with_a_fresh_link(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    bind_tenant(seeded, COMPANY_ID)
    await store_demo_files(seeded, get_storage())
    export = await seeded.scalar(
        select(ExportRecord).where(ExportRecord.package_id == uid("pkg_1033"))
    )
    assert export is not None
    r = await client.get(f"/v1/exports/{export.id}/download", headers=auth("u5"))
    assert r.status_code == 200
    assert_matches("SignedUrl", r.json())
    async with httpx.AsyncClient() as raw:
        assert (await raw.get(r.json()["url"])).content.startswith(b"PK")  # a zip
    missing = await client.get(f"/v1/exports/{uid('nope')}/download", headers=auth("u5"))
    assert missing.status_code == 404


async def test_demo_reset_restores_the_fixtures(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    bind_tenant(seeded, COMPANY_ID)
    pkg = await seeded.get_one(InvoicePackage, uid("pkg_1042"))
    pkg.version = 7
    await seeded.flush()
    assert (await client.post("/v1/demo/reset")).status_code == 401
    assert (await client.post("/v1/demo/reset", headers=auth("u1"))).status_code == 204
    seeded.expire_all()
    assert (await seeded.get_one(InvoicePackage, uid("pkg_1042"))).version == 1
    assert await seeded.scalar(select(func.count()).select_from(InvoicePackage)) == 14
