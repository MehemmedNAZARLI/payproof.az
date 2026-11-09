import datetime as dt

from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.models import Order
from tests.integration.factories import Tenant, add, add_fails, package


async def test_new_package_defaults(db: AsyncSession, a: Tenant) -> None:
    pkg = package(a)
    await add(db, pkg)
    await db.refresh(pkg)
    assert (pkg.version, pkg.processing, pkg.order_id, pkg.deleted_at) == (1, False, None, None)


async def test_invoice_number_unique_per_customer(db: AsyncSession, a: Tenant, b: Tenant) -> None:
    await add(db, package(a), package(b))
    await add_fails(db, package(a))


async def test_invoice_fields_unknown_while_processing(db: AsyncSession, a: Tenant) -> None:
    # POST /v1/packages creates the row before extraction (openapi: "null while PROCESSING")
    blank = {"invoice_number": None, "currency": None, "invoice_date": None, "processing": True}
    await add(db, package(a, **blank), package(a, **blank))


async def test_deleted_package_frees_invoice_number(db: AsyncSession, a: Tenant) -> None:
    await add(db, package(a, deleted_at=dt.datetime.now(dt.UTC)))
    await add(db, package(a))


async def test_owner_must_be_member(db: AsyncSession, a: Tenant, b: Tenant) -> None:
    await add_fails(db, package(a, owner_id=b.user.id))


async def test_order_link_needs_method_and_same_tenant(
    db: AsyncSession, a: Tenant, b: Tenant
) -> None:
    orders = [
        Order(
            company_id=t.company.id,
            customer_id=t.customer.id,
            po_number="PO-381",
            currency="AZN",
            order_date=dt.date(2026, 10, 28),
        )
        for t in (a, b)
    ]
    await add(db, *orders)
    await add(db, package(a, "INV-1", order_id=orders[0].id, link_method="exact_id"))
    await add(db, package(a, "INV-2", order_id=orders[0].id, link_method="human",
                          link_confirmed_by=a.user.id))  # fmt: skip
    await add_fails(db, package(a, "INV-3", order_id=orders[0].id))  # no method
    await add_fails(db, package(a, "INV-4", order_id=orders[0].id, link_method="human"))
    await add_fails(db, package(a, "INV-5", order_id=orders[1].id, link_method="exact_id"))
    await add_fails(db, package(a, "INV-6", link_confirmed_by=a.user.id))  # confirmer, no link
