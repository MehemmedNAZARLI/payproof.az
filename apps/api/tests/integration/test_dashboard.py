import datetime as dt

from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.base import bind_tenant
from payproof.seed.cli import seed
from payproof.seed.fixtures import EXPECTED, uid
from payproof.services.dashboard import baku_days_between, build_dashboard

NOW = dt.datetime.fromisoformat(EXPECTED["demo_now"])


def test_baku_calendar_days() -> None:
    # 23:30 Baku on the 3rd -> 00:10 Baku on the 4th is one calendar day, not 0.03
    a = dt.datetime(2026, 11, 3, 19, 30, tzinfo=dt.UTC)
    b = dt.datetime(2026, 11, 3, 20, 10, tzinfo=dt.UTC)
    assert baku_days_between(a, b) == 1
    assert baku_days_between(b, a) == 0  # never negative


async def test_dashboard_matches_expected(db: AsyncSession) -> None:
    await seed(db)
    bind_tenant(db, uid("company_a"))
    d = await build_dashboard(db, now=NOW)
    expected = EXPECTED["dashboard"]
    assert d.status_counts == expected["status_counts"]
    assert [
        (t.total.amount, t.total.currency, t.package_count) for t in d.open_problem_amounts
    ] == [(x["amount"], x["currency"], x["packages"]) for x in expected["open_problem_amounts"]]
    assert d.problem_age.average_days == expected["avg_problem_days"] == "3.0"
    assert d.problem_age.longest is not None
    assert (d.problem_age.longest.package.invoice_number, d.problem_age.longest.days) == (
        expected["longest_problem"]["invoice_number"],
        expected["longest_problem"]["days"],
    )
    assert (d.package_count, d.customer_count) == (14, 2)


async def test_dashboard_details(db: AsyncSession) -> None:
    await seed(db)
    bind_tenant(db, uid("company_a"))
    d = await build_dashboard(db, now=NOW)
    # INV-1038 4860.00 + INV-1036 6200.00
    ready = [(t.total.amount, t.total.currency, t.package_count) for t in d.ready_amounts]
    assert ready == [("11060.00", "AZN", 2)]
    times = [a.approved_at for a in d.recent_approvals]
    assert len(times) == 4 and times == sorted(times, reverse=True)
    assert d.tasks.total == 9 and d.tasks.resolved == 3
    assert d.top_issue is not None and d.top_issue.package_count >= 2
    # cascade results are never counted
    assert all(r.fail + r.unknown > 0 for r in d.rule_counts)
