"""GET /v1/packages: filter, sort and page package states (port of the mock list handler).
shortcut: filtering and sorting run in memory over the tenant's live packages; move them into
SQL once a tenant has thousands of packages."""

import datetime as dt
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from payproof.core.paging import decode_cursor, encode_cursor
from payproof.domain.enums import PackageStatus
from payproof.schemas import packages as s
from payproof.schemas.auth import UserRef
from payproof.services.package_query import PackageState

_STATUS_ORDER = [
    PackageStatus.NEEDS_FIX,
    PackageStatus.NEEDS_REVIEW,
    PackageStatus.PROCESSING,
    PackageStatus.READY_FOR_APPROVAL,
    PackageStatus.APPROVED_READY,
    PackageStatus.EXPORTED,
]

SORT_KEYS: dict[str, Callable[[PackageState], Any]] = {
    "invoice_number": lambda x: x.package.invoice_number or "",
    "customer": lambda x: x.customer_name,
    "invoice_date": lambda x: x.package.invoice_date or dt.date.min,
    "total": lambda x: (x.total.currency, x.total.amount) if x.total else ("", 0),
    "status": lambda x: _STATUS_ORDER.index(x.status),
    "blocking": lambda x: len(x.blockers),
    "owner": lambda x: x.owner.full_name,
    "updated_at": lambda x: x.package.updated_at,
    # sorts by age like the mock (-problem_since, no problem = -inf): `-problem_age` puts the
    # longest-waiting problem first and packages without a problem last
    "problem_age": lambda x: (
        (1, -x.package.problem_since.timestamp()) if x.package.problem_since else (0, 0.0)
    ),
}


@dataclass(frozen=True)
class ListQuery:
    statuses: frozenset[PackageStatus] = frozenset()
    customer_id: uuid.UUID | None = None
    owner_id: uuid.UUID | None = None
    issue: str | None = None
    date_from: dt.date | None = None
    date_to: dt.date | None = None
    q: str | None = None
    sort: str = "-updated_at"
    limit: int = 50
    cursor: str | None = None


def _matches(x: PackageState, f: ListQuery) -> bool:
    p = x.package
    if f.statuses and x.status not in f.statuses:
        return False
    if f.customer_id and p.customer_id != f.customer_id:
        return False
    if f.owner_id and p.owner_id != f.owner_id:
        return False
    if f.issue and not any(b.rule_id == f.issue for b in x.blockers):
        return False
    if f.date_from and (p.invoice_date is None or p.invoice_date < f.date_from):
        return False
    if f.date_to and (p.invoice_date is None or p.invoice_date > f.date_to):
        return False
    if f.q:
        needle = f.q.strip().lower()
        hay = (p.invoice_number, x.customer_name, x.po_ref, x.order_po, x.delivery_no)
        return any(needle in h.lower() for h in hay if h)
    return True


def list_item(x: PackageState) -> s.PackageListItem:
    p = x.package
    return s.PackageListItem(
        id=p.id,
        invoice_number=p.invoice_number,
        version=p.version,
        status=x.status,
        customer=s.CustomerRef(id=p.customer_id, name=x.customer_name),
        invoice_date=p.invoice_date,
        total=s.Money.of(x.total) if x.total else None,
        po_ref=x.po_ref,
        po_unreadable=x.po_unreadable,
        blocking=[s.Blocker(rule_id=b.rule_id, outcome=b.outcome.value) for b in x.blockers],
        owner=UserRef(
            id=x.owner.id, full_name=x.owner.full_name, title=x.owner.title, role=x.owner_role
        ),
        problem_since=p.problem_since,
        updated_at=p.updated_at,
    )


def page(states: list[PackageState], f: ListQuery) -> s.PackagePage:
    rows = [x for x in states if _matches(x, f)]
    key = SORT_KEYS[f.sort.removeprefix("-")]
    rows.sort(key=lambda x: str(x.package.id))  # stable tie-break across pages
    rows.sort(key=key, reverse=f.sort.startswith("-"))
    start = decode_cursor(f.cursor)
    end = start + f.limit
    next_cursor = encode_cursor(end) if end < len(rows) else None
    return s.PackagePage(
        items=[list_item(x) for x in rows[start:end]],
        next_cursor=next_cursor,
        total_count=len(rows),
    )
