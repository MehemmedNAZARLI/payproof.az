import io
import json
import uuid
import zipfile

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.errors import InvalidInput, PackageNotReady
from payproof.repositories.base import bind_tenant
from payproof.repositories.models import DocumentVersion, RequirementSet
from payproof.seed.cli import seed
from payproof.seed.files import placeholder, store_placeholders
from payproof.seed.fixtures import uid
from payproof.seed.identity import COMPANY_ID
from payproof.seed.packages import version_id
from payproof.services.export import Exported, InvoiceRequired, export
from payproof.services.package_query import load_states
from payproof.storage.s3 import get_storage


async def _export(db: AsyncSession, pkg: str, ids: list[uuid.UUID], version: int = 1) -> Exported:
    [state] = await load_states(db, [uid(pkg)])
    assert state.rule_set_id is not None
    rs = await db.get_one(RequirementSet, state.rule_set_id)
    return await export(
        db, get_storage(), actor_id=uid("u1"), package_id=uid(pkg), expected_version=version,
        expected_rule_set_version=rs.version, version_ids=ids,
    )  # fmt: skip


async def test_only_selected_files_and_no_internal_content(db: AsyncSession) -> None:
    await seed(db)
    bind_tenant(db, COMPANY_ID)
    versions = (await db.scalars(select(DocumentVersion))).all()
    await store_placeholders(get_storage(), versions)  # the files the zip is made of
    invoice = version_id("pkg_1035", "invoice", 1)

    done = await _export(db, "pkg_1035", [invoice])  # APPROVED_READY; order not selected

    assert done.created
    assert done.export.files == [
        {"document_version_id": str(invoice), "type": "invoice", "file_name": "INV-1035.pdf"}
    ]
    z = zipfile.ZipFile(io.BytesIO(await get_storage().get(done.zip_key)))
    assert sorted(z.namelist()) == ["invoice/INV-1035.pdf", "manifest.json"]
    assert z.read("invoice/INV-1035.pdf") == placeholder("INV-1035.pdf")
    manifest = z.read("manifest.json").decode()
    assert [f["file_name"] for f in json.loads(manifest)["files"]] == ["INV-1035.pdf"]
    for internal in ("explanation", "comment", "audit", "reason", "evidence"):
        assert internal not in manifest
    again = await _export(db, "pkg_1035", [invoice])
    assert not again.created and again.export.id == done.export.id


async def test_refusals(db: AsyncSession) -> None:
    await seed(db)
    bind_tenant(db, COMPANY_ID)
    with pytest.raises(PackageNotReady):
        await _export(db, "pkg_1038", [version_id("pkg_1038", "invoice", 1)])  # not approved
    with pytest.raises(InvoiceRequired):
        await _export(db, "pkg_1035", [version_id("pkg_1035", "delivery", 1)])
    with pytest.raises(InvalidInput):
        await _export(db, "pkg_1035", [])
