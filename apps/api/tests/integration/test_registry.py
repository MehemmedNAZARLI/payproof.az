import json

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.models import DocumentTypeEntry
from payproof.services import registry


async def test_sync_inserts_every_fixture_entry_once(db: AsyncSession) -> None:
    await registry.sync(db)
    await registry.sync(db)  # idempotent
    rows = (await db.scalars(select(DocumentTypeEntry).order_by(DocumentTypeEntry.key))).all()
    entries = registry.load_entries()
    assert sorted(r.key for r in rows) == sorted(e["key"] for e in entries)
    invoice = next(r for r in rows if r.key == "invoice")
    assert invoice.builtin and invoice.version == 1
    fields = [f["key"] for f in invoice.extraction["fields"]]
    assert fields[:2] == ["invoice_number", "invoice_date"]


async def test_changed_schema_without_a_new_version_is_refused(db: AsyncSession) -> None:
    await registry.sync(db)
    entries = registry.load_entries()
    entries[0] = {**entries[0], "name": "Başqa ad"}
    with pytest.raises(registry.RegistryMismatch, match="invoice v1"):
        await registry.sync(db, entries)


async def test_new_version_is_added_and_becomes_current(db: AsyncSession) -> None:
    await registry.sync(db)
    entries = json.loads(json.dumps(registry.load_entries()))
    entries[3]["version"] = 2
    entries[3]["instructions"] += " Yeni."
    await registry.sync(db, entries)
    count = await db.scalar(select(func.count()).where(DocumentTypeEntry.key == entries[3]["key"]))
    assert count == 2
    current = await registry.current(db)
    assert current[entries[3]["key"]].version == 2


async def test_registry_rows_are_immutable(db: AsyncSession) -> None:
    await registry.sync(db)
    row = await db.scalar(select(DocumentTypeEntry).where(DocumentTypeEntry.key == "receipt"))
    assert row is not None
    row.name = "Dəyişdi"
    with pytest.raises(DBAPIError):
        await db.flush()
