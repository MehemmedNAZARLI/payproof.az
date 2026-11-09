from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.base import bind_tenant
from payproof.repositories.models import CheckResult, InvoicePackage
from payproof.seed.cli import seed
from payproof.seed.fixtures import EXPECTED, uid
from payproof.seed.identity import COMPANY_ID
from payproof.services.package_query import load_states
from payproof.services.validation import revalidate


async def test_revalidation_stores_a_run_the_status_is_derived_from(db: AsyncSession) -> None:
    await seed(db)
    bind_tenant(db, COMPANY_ID)
    pkg = await db.get_one(InvoicePackage, uid("pkg_1047"))
    run = await revalidate(db, pkg)
    assert run is not None and run.package_version == pkg.version
    rows = (
        await db.scalars(select(CheckResult).where(CheckResult.validation_run_id == run.id))
    ).all()
    assert {r.rule_id: r.outcome for r in rows} == EXPECTED["packages"]["INV-1047"]["checks"]
    r001 = next(r for r in rows if r.rule_id == "R-001")
    assert r001.evidence_ids  # the unread PO's quote on the invoice
    [state] = await load_states(db, [pkg.id])
    assert state.run is not None and state.run.id == run.id
    assert state.status == EXPECTED["packages"]["INV-1047"]["status"]


async def test_nothing_to_evaluate_while_processing(db: AsyncSession) -> None:
    await seed(db)
    bind_tenant(db, COMPANY_ID)
    assert await revalidate(db, await db.get_one(InvoicePackage, uid("pkg_1050"))) is None
