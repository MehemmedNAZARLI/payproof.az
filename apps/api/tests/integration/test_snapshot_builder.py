from sqlalchemy.ext.asyncio import AsyncSession

from payproof.domain.rules.engine import evaluate
from payproof.repositories.base import bind_tenant
from payproof.seed.cli import seed
from payproof.seed.fixtures import EXPECTED, uid
from payproof.services.package_query import load_states
from payproof.services.snapshot_builder import build_snapshot


async def test_snapshot_from_db_reproduces_expected_checks(db: AsyncSession) -> None:
    """The DB round trip (seed -> tables -> snapshot) loses nothing the rules read."""
    await seed(db)
    bind_tenant(db, uid("company_a"))
    for state in await load_states(db):
        number = state.package.invoice_number
        snapshot = await build_snapshot(db, state)
        if state.package.processing:
            assert snapshot is None, number
            continue
        assert snapshot is not None, number
        got = {c.rule_id: c.outcome.value for c in evaluate(snapshot)}
        assert got == EXPECTED["packages"][number]["checks"], number
