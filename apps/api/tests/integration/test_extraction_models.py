from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.models import ExtractedInvoice, ExtractedInvoiceLine
from tests.integration.factories import Tenant, add, add_fails, make_version


def _invoice(version_id: object, company_id: object, **over: object) -> ExtractedInvoice:
    fields: dict[str, object] = {
        "po_ref": "PO-381",
        "total": Decimal("12000.00"),
        "currency": "AZN",
    }
    fields.update(over)
    return ExtractedInvoice(company_id=company_id, document_version_id=version_id, **fields)


def _line(inv: ExtractedInvoice, code: str = "GY-1L", **over: object) -> ExtractedInvoiceLine:
    fields: dict[str, object] = {"qty": Decimal("800"), "unit_price": Decimal("9.00")}
    fields.update(over)
    return ExtractedInvoiceLine(
        company_id=inv.company_id, extracted_invoice_id=inv.id, product_code=code, **fields
    )


async def test_unreadable_fields_are_null(db: AsyncSession, a: Tenant) -> None:
    v = await make_version(db, a)
    inv = _invoice(v.id, a.company.id, po_ref=None, total=None, currency=None)
    await add(db, inv)
    await add(db, _line(inv, qty=None, unit_price=None))  # scan: values not read -> UNKNOWN


async def test_one_result_per_document_version(db: AsyncSession, a: Tenant) -> None:
    v = await make_version(db, a)
    await add(db, _invoice(v.id, a.company.id))
    await add_fails(db, _invoice(v.id, a.company.id))


async def test_version_must_be_same_tenant(db: AsyncSession, a: Tenant, b: Tenant) -> None:
    v = await make_version(db, a)
    await add_fails(db, _invoice(v.id, b.company.id))


async def test_currency_known(db: AsyncSession, a: Tenant) -> None:
    v = await make_version(db, a)
    await add_fails(db, _invoice(v.id, a.company.id, currency="EUR"))


async def test_lines_unique_and_positive(db: AsyncSession, a: Tenant) -> None:
    v = await make_version(db, a)
    inv = _invoice(v.id, a.company.id)
    await add(db, inv)
    await add(db, _line(inv))
    await add_fails(db, _line(inv))
    await add_fails(db, _line(inv, "DY-5", qty=Decimal("0")))
    await add_fails(db, _line(inv, "DY-5", unit_price=Decimal("-1")))
