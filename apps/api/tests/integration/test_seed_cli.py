from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.base import bind_tenant
from payproof.repositories.models import AuditEvent, InvoicePackage, RequirementSet, User
from payproof.repositories.orm import Base
from payproof.seed.cli import reset, seed
from payproof.seed.identity import COMPANY_ID


async def _counts(db: AsyncSession) -> dict[str, int]:
    bind_tenant(db, COMPANY_ID)  # the guard also covers Core selects on tenant tables
    out = {}
    for table in Base.metadata.sorted_tables:
        out[table.name] = (await db.execute(select(func.count()).select_from(table))).scalar_one()
    return out


async def test_second_run_adds_nothing(db: AsyncSession) -> None:
    assert await seed(db) is True
    first = await _counts(db)
    assert first["invoice_packages"] == 14 and first["users"] == 7
    assert await seed(db) is False  # already seeded: no duplicates
    assert await _counts(db) == first


async def test_reset_truncates_despite_immutable_and_append_only_triggers(
    db: AsyncSession,
) -> None:
    await seed(db)
    db.add(
        AuditEvent(
            company_id=COMPANY_ID, action="package.created", object_type="package", message="x"
        )
    )
    await db.flush()
    before = await _counts(db)
    await reset(db)  # DELETE would hit the requirement_sets / audit_events triggers
    assert set((await _counts(db)).values()) == {0}
    await seed(db)
    after = await _counts(db)
    # the reseed restores the demo history; only the extra event added above is gone
    assert after == {**before, "audit_events": before["audit_events"] - 1}
    for model in (User, RequirementSet, InvoicePackage):
        assert (await db.execute(select(func.count()).select_from(model))).scalar_one() > 0
