import datetime as dt
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.models import DeliveryNote, DeliveryNoteLine
from tests.integration.factories import Tenant, add, add_fails, make_version


def _note(version_id: object, t: Tenant, **over: object) -> DeliveryNote:
    fields: dict[str, object] = {
        "note_number": "TS-5524",
        "po_ref": "PO-377",
        "customer_id": t.customer.id,
        "signed": True,
        "delivery_date": dt.date(2026, 10, 30),
    }
    fields.update(over)
    return DeliveryNote(company_id=t.company.id, document_version_id=version_id, **fields)


def _line(note: DeliveryNote, code: str = "ST-1", qty: str | None = "1200") -> DeliveryNoteLine:
    return DeliveryNoteLine(
        company_id=note.company_id,
        delivery_note_id=note.id,
        product_code=code,
        qty=None if qty is None else Decimal(qty),
    )


async def test_unreadable_fields_are_null(db: AsyncSession, a: Tenant) -> None:
    v = await make_version(db, a, "delivery")
    fields = ("note_number", "po_ref", "customer_id", "signed", "delivery_date")
    note = _note(v.id, a, **dict.fromkeys(fields))
    await add(db, note)
    await add(db, _line(note, qty=None))


async def test_one_note_per_document_version(db: AsyncSession, a: Tenant) -> None:
    v = await make_version(db, a, "delivery")
    await add(db, _note(v.id, a))
    await add_fails(db, _note(v.id, a))


async def test_customer_must_be_same_tenant(db: AsyncSession, a: Tenant, b: Tenant) -> None:
    v = await make_version(db, a, "delivery")
    await add_fails(db, _note(v.id, a, customer_id=b.customer.id))


async def test_lines_unique_and_positive(db: AsyncSession, a: Tenant) -> None:
    v = await make_version(db, a, "delivery")
    note = _note(v.id, a)
    await add(db, note)
    await add(db, _line(note))
    await add_fails(db, _line(note))
    await add_fails(db, _line(note, "CQ-250", "0"))
