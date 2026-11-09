"""Dashboard (port of the prototype/mock `dashboard()`): every package counted once, money per
currency (never summed across or converted), cascade results never counted."""

import datetime as dt
from collections.abc import Iterable
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.domain.enums import CheckOutcome, PackageStatus, TaskStatus
from payproof.domain.money import Money as DomainMoney
from payproof.domain.rules.catalog import CATEGORIES
from payproof.repositories import package_reads as reads
from payproof.repositories.models import ApprovalRecord, ExportRecord, ResolutionTask
from payproof.schemas import packages as s
from payproof.schemas.auth import UserRef
from payproof.services.package_query import PackageState, load_states

BAKU = ZoneInfo("Asia/Baku")
_OPEN = (PackageStatus.NEEDS_FIX, PackageStatus.NEEDS_REVIEW)


def baku_days_between(start: dt.datetime, end: dt.datetime) -> int:
    """Calendar days in Baku, like the prototype (problem age is shown in whole days)."""
    return max(0, (end.astimezone(BAKU).date() - start.astimezone(BAKU).date()).days)


def _per_currency(states: Iterable[PackageState]) -> list[s.CurrencyTotal]:
    sums: dict[str, tuple[DomainMoney, int]] = {}
    for st in states:
        if st.total is None:
            continue
        cur = st.total.currency
        prev, n = sums.get(cur, (DomainMoney(0, cur), 0))
        sums[cur] = (prev + st.total, n + 1)
    return [s.CurrencyTotal(total=s.Money.of(m), package_count=n) for m, n in sums.values()]


def _ref(st: PackageState) -> s.PackageRef:
    return s.PackageRef(id=st.package.id, invoice_number=st.package.invoice_number or "")


async def build_dashboard(session: AsyncSession, *, now: dt.datetime) -> s.Dashboard:
    states = sorted(await load_states(session), key=lambda x: x.package.invoice_number or "")
    counts = {status.value: 0 for status in PackageStatus}
    for st in states:
        counts[st.status.value] += 1
    open_ = [st for st in states if st.status in _OPEN]
    rules: dict[str, list[int]] = {}
    categories: dict[str, tuple[set[str], list[str]]] = {}
    for st in states:
        if st.status is PackageStatus.EXPORTED:
            continue
        for b in st.blockers:
            rules.setdefault(b.rule_id, [0, 0])[b.outcome is CheckOutcome.UNKNOWN] += 1
            rule_ids, invoices = categories.setdefault(CATEGORIES[b.rule_id], (set(), []))
            rule_ids.add(b.rule_id)
            if (number := st.package.invoice_number or "") not in invoices:
                invoices.append(number)
    top = max(categories.items(), key=lambda kv: len(kv[1][1]), default=None)
    ages = [
        (st, baku_days_between(st.package.problem_since or st.package.created_at, now))
        for st in open_
    ]
    longest = max(ages, key=lambda a: a[1], default=None)
    average = Decimal(sum(d for _, d in ages)) / len(ages) if ages else Decimal(0)
    return s.Dashboard(
        as_of=now,
        package_count=len(states),
        customer_count=len({st.package.customer_id for st in states}),
        status_counts=counts,
        open_problem_amounts=_per_currency(open_),
        ready_amounts=_per_currency(
            st for st in states if st.status is PackageStatus.READY_FOR_APPROVAL
        ),
        top_issue=s.TopIssue(
            category=top[0],
            rule_ids=sorted(top[1][0]),
            package_count=len(top[1][1]),
            invoice_numbers=top[1][1],
        )
        if top
        else None,
        rule_counts=[
            s.RuleCount(rule_id=r, fail=f, unknown=u) for r, (f, u) in sorted(rules.items())
        ],
        problem_age=s.ProblemAge(
            average_days=str(average.quantize(Decimal("0.1"), ROUND_HALF_UP)),
            longest=s.LongestProblem(package=_ref(longest[0]), days=longest[1])
            if longest
            else None,
        ),
        tasks=await _task_progress(session),
        recent_approvals=await _recent_approvals(session, states),
    )


async def _task_progress(session: AsyncSession) -> s.TaskProgress:
    q = (
        select(ResolutionTask.status, func.count())
        .where(ResolutionTask.deleted_at.is_(None))
        .group_by(ResolutionTask.status)
    )
    by_status = {status: n for status, n in (await session.execute(q)).all()}
    return s.TaskProgress(
        resolved=by_status.get(TaskStatus.RESOLVED.value, 0), total=sum(by_status.values())
    )


async def _recent_approvals(
    session: AsyncSession, states: list[PackageState]
) -> list[s.RecentApproval]:
    by_id = {st.package.id: st for st in states}
    approvals = (
        await session.scalars(
            select(ApprovalRecord)
            .where(ApprovalRecord.package_id.in_(by_id))
            .order_by(ApprovalRecord.created_at.desc())
            .limit(5)
        )
    ).all()
    approvers = await reads.owners(session, {a.approver_id for a in approvals})
    exports = await session.execute(
        select(ExportRecord.package_id, ExportRecord.package_version).where(
            ExportRecord.package_id.in_({a.package_id for a in approvals})
        )
    )
    exported = {(pid, pv) for pid, pv in exports.all()}
    out = []
    for a in approvals:
        st = by_id[a.package_id]
        user, role = approvers[a.approver_id]
        if st.total is None:
            continue  # an approved package always has an extracted total
        out.append(
            s.RecentApproval(
                package=_ref(st),
                version=a.package_version,
                approver=UserRef(id=user.id, full_name=user.full_name, title=user.title, role=role),
                approved_at=a.created_at,
                total=s.Money.of(st.total),
                valid=a.valid,
                exported=(a.package_id, a.package_version) in exported,
            )
        )
    return out
