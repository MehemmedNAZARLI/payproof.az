from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.base import bind_tenant
from payproof.repositories.models import Company, Customer, User
from payproof.seed.cli import seed
from payproof.seed.fixtures import EXPECTED, uid
from payproof.services.package_query import load_states
from tests.integration.factories import Tenant, add, package


@contextmanager
def count_queries(db: AsyncSession) -> Iterator[list[str]]:
    statements: list[str] = []
    conn = db.sync_session.connection()

    def before(*args: object) -> None:
        statements.append(str(args[2]))

    event.listen(conn, "before_cursor_execute", before)
    try:
        yield statements
    finally:
        event.remove(conn, "before_cursor_execute", before)


async def test_status_and_blockers_from_latest_run_match_expected(db: AsyncSession) -> None:
    await seed(db)
    bind_tenant(db, uid("company_a"))
    states = {s.package.invoice_number: s for s in await load_states(db)}
    assert len(states) == 14
    for number, expected in EXPECTED["packages"].items():
        state = states[number]
        assert state.status.value == expected["status"], number
        assert [{"rule_id": b.rule_id, "outcome": b.outcome.value} for b in state.blockers] == (
            expected["blockers"]
        ), number


async def test_list_fields(db: AsyncSession) -> None:
    await seed(db)
    bind_tenant(db, uid("company_a"))
    s = {x.package.invoice_number: x for x in await load_states(db)}
    assert (str(s["INV-1042"].total), s["INV-1042"].po_ref) == ("12000.00", None)
    assert s["INV-1047"].po_unreadable and not s["INV-1042"].po_unreadable
    assert s["INV-1038"].order_po == "PO-377" and s["INV-1042"].order_po is None
    assert s["INV-1046"].delivery_no == "TS-5529"
    assert s["INV-1050"].total is None  # openapi: null while PROCESSING (not extracted yet)


async def test_query_count_does_not_grow_with_packages(db: AsyncSession) -> None:
    await seed(db)
    bind_tenant(db, uid("company_a"))
    with count_queries(db) as first:
        await load_states(db)
    a = Tenant(
        company=await db.get(Company, uid("company_a")),  # type: ignore[arg-type]
        user=await db.get(User, uid("u1")),  # type: ignore[arg-type]
        customer=await db.get(Customer, uid("c1")),  # type: ignore[arg-type]
    )
    await add(db, *(package(a, f"X-{i}") for i in range(5)))
    with count_queries(db) as second:
        assert len(await load_states(db)) == 19
    assert len(first) == len(second) <= 12  # fixed per call: no N+1
