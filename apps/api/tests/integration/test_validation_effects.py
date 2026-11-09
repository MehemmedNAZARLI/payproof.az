import datetime as dt

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.domain.enums import PackageStatus, TaskStatus
from payproof.repositories.base import bind_tenant
from payproof.repositories.models import InvoicePackage, Notification, ResolutionTask
from payproof.seed.cli import seed
from payproof.seed.fixtures import uid
from payproof.seed.identity import COMPANY_ID
from payproof.services.validation import revalidate
from payproof.services.validation_effects import status_changed


def _task(rule: str, number: str, status: TaskStatus) -> ResolutionTask:
    return ResolutionTask(
        company_id=COMPANY_ID, number=number, package_id=uid("pkg_1047"), rule_id=rule,
        assignee_id=uid("u6"), created_by=uid("u1"), step="Düzəliş",
        due_date=dt.date(2026, 11, 12), status=status,
    )  # fmt: skip


async def _pkg(db: AsyncSession, slug: str) -> InvoicePackage:
    await seed(db)
    bind_tenant(db, COMPANY_ID)
    return await db.get_one(InvoicePackage, uid(slug))


async def _notes(db: AsyncSession, pkg: InvoicePackage) -> list[Notification]:
    q = select(Notification).where(Notification.package_id == pkg.id)
    return list((await db.scalars(q)).all())


async def test_tasks_resolve_only_when_their_rule_passes(db: AsyncSession) -> None:
    pkg = await _pkg(db, "pkg_1047")  # R-001 UNKNOWN (PO not read), R-002 UNKNOWN, R-003 PASS
    passing = _task("R-003", "T-901", TaskStatus.OPEN)
    recheck = _task("R-002", "T-902", TaskStatus.SUBMITTED_FOR_RECHECK)
    db.add_all([passing, recheck])
    await db.flush()
    unknown = (  # seeded T-121: R-001, OPEN
        await db.scalars(select(ResolutionTask).where(ResolutionTask.number == "T-121"))
    ).one()

    await revalidate(db, pkg)

    assert passing.status == TaskStatus.RESOLVED and passing.resolved_at is not None
    assert recheck.status == TaskStatus.IN_PROGRESS  # submitted, but the rule still fails
    assert unknown.status == TaskStatus.OPEN  # UNKNOWN is never a pass


async def test_problem_clock_and_ready_notice(db: AsyncSession) -> None:
    ready = await _pkg(db, "pkg_1038")  # READY_FOR_APPROVAL
    ready.problem_since = dt.datetime(2026, 11, 1, tzinfo=dt.UTC)
    before = len(await _notes(db, ready))
    await revalidate(db, ready)  # still ready: no new notice
    assert ready.problem_since is None and len(await _notes(db, ready)) == before

    await status_changed(db, ready, PackageStatus.NEEDS_FIX, PackageStatus.READY_FOR_APPROVAL, None)
    await db.flush()
    new = (await _notes(db, ready))[before:]
    assert {n.user_id for n in new} == {uid("u2")}  # the approvers
    assert new[0].text == "INV-1038 təsdiqinizi gözləyir"

    fix = await db.get_one(InvoicePackage, uid("pkg_1044"))  # NEEDS_FIX keeps its clock
    since = fix.problem_since
    await revalidate(db, fix)
    assert fix.problem_since == since is not None
