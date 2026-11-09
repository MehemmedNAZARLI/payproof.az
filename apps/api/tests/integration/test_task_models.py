import datetime as dt

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.models import InvoicePackage, ResolutionTask
from tests.integration.factories import Tenant, add, add_fails, package


def _task(
    pkg: InvoicePackage, t: Tenant, number: str = "T-118", /, **over: object
) -> ResolutionTask:
    fields: dict[str, object] = {
        "number": number,
        "rule_id": "R-005",
        "assignee_id": t.user.id,
        "created_by": t.user.id,
        "step": "KY-10 üçün qiyməti yoxlayın",
        "due_date": dt.date(2026, 11, 10),
    }
    fields.update(over)
    return ResolutionTask(company_id=pkg.company_id, package_id=pkg.id, **fields)


async def _pkg(db: AsyncSession, t: Tenant) -> InvoicePackage:
    pkg = package(t)
    await add(db, pkg)
    return pkg


async def test_task_defaults_to_open(db: AsyncSession, a: Tenant) -> None:
    task = _task(await _pkg(db, a), a)
    await add(db, task)
    await db.refresh(task)
    assert (task.status, task.resolved_at, task.comment) == ("OPEN", None, None)


async def test_number_unique_per_company(db: AsyncSession, a: Tenant, b: Tenant) -> None:
    pa, pb = await _pkg(db, a), await _pkg(db, b)
    await add(db, _task(pa, a), _task(pb, b))
    await add_fails(db, _task(pa, a, rule_id="R-001"))


async def test_one_open_task_per_rule(db: AsyncSession, a: Tenant) -> None:
    pkg = await _pkg(db, a)
    await add(db, _task(pkg, a))
    await add_fails(db, _task(pkg, a, "T-119"))
    resolved = {"status": "RESOLVED", "resolved_at": dt.datetime.now(dt.UTC)}
    await add(db, _task(pkg, a, "T-120", **resolved))  # closed ones do not count
    await add(db, _task(pkg, a, "T-121", deleted_at=dt.datetime.now(dt.UTC)))  # cancelled


async def test_resolved_needs_timestamp(db: AsyncSession, a: Tenant) -> None:
    pkg = await _pkg(db, a)
    await add_fails(db, _task(pkg, a, status="RESOLVED"))
    await add_fails(db, _task(pkg, a, "T-2", resolved_at=dt.datetime.now(dt.UTC)))


async def test_assignee_must_be_member(db: AsyncSession, a: Tenant, b: Tenant) -> None:
    await add_fails(db, _task(await _pkg(db, a), a, assignee_id=b.user.id))


@pytest.mark.parametrize(
    "over",
    [{"number": "118"}, {"rule_id": "R-11"}, {"status": "DONE"}, {"step": ""}],
    ids=["number", "rule", "status", "step"],
)
async def test_task_checks(db: AsyncSession, a: Tenant, over: dict[str, object]) -> None:
    await add_fails(db, _task(await _pkg(db, a), a, **over))
