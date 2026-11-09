import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.models import Document
from tests.integration.factories import (
    Tenant,
    add,
    add_fails,
    make_document,
    package,
    version,
)


async def test_one_document_per_type(db: AsyncSession, a: Tenant) -> None:
    doc = await make_document(db, a)
    other = Document(company_id=a.company.id, package_id=doc.package_id, type="invoice")
    await add_fails(db, other)


async def test_unknown_document_type(db: AsyncSession, a: Tenant) -> None:
    pkg = package(a)
    await add(db, pkg)
    await add_fails(db, Document(company_id=a.company.id, package_id=pkg.id, type="receipt"))


async def test_document_package_must_be_same_tenant(db: AsyncSession, a: Tenant, b: Tenant) -> None:
    pkg = package(a)
    await add(db, pkg)
    await add_fails(db, Document(company_id=b.company.id, package_id=pkg.id, type="invoice"))


async def test_versions_are_numbered_and_kept(db: AsyncSession, a: Tenant) -> None:
    doc = await make_document(db, a)
    v1 = version(doc, a, 1)
    await add(db, v1, version(doc, a, 2, sha256="b" * 64))
    await db.refresh(v1)
    assert v1.status == "UPLOADED"
    await add_fails(db, version(doc, a, 2, storage_key="other"))


@pytest.mark.parametrize(
    "over",
    [
        {"sha256": "XYZ"},
        {"status": "DONE"},
        {"source_kind": "docx"},
        {"size": 0},
        {"pages": 0},
        {"package_version_at_upload": 0},
    ],
    ids=lambda o: next(iter(o)),
)
async def test_version_checks(db: AsyncSession, a: Tenant, over: dict[str, object]) -> None:
    doc = await make_document(db, a)
    await add_fails(db, version(doc, a, **over))


async def test_uploader_must_be_member(db: AsyncSession, a: Tenant, b: Tenant) -> None:
    doc = await make_document(db, a)
    await add_fails(db, version(doc, a, uploaded_by=b.user.id))
