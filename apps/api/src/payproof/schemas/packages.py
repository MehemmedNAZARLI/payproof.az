"""HTTP shapes of the package list and dashboard (openapi: PackageListItem, PackagePage,
Dashboard). Money is a string amount plus currency, never a number."""

import datetime as dt
import uuid
from typing import Literal

from pydantic import BaseModel

from payproof.domain.enums import Currency, PackageStatus
from payproof.domain.money import Money as DomainMoney
from payproof.schemas.auth import UserRef


class Money(BaseModel):
    amount: str
    currency: Currency

    @classmethod
    def of(cls, m: DomainMoney) -> "Money":
        return cls(amount=str(m), currency=m.currency)


class CustomerRef(BaseModel):
    id: uuid.UUID
    name: str


class PackageRef(BaseModel):
    id: uuid.UUID
    invoice_number: str


class Blocker(BaseModel):
    rule_id: str
    outcome: Literal["FAIL", "UNKNOWN"]


class PackageListItem(BaseModel):
    id: uuid.UUID
    invoice_number: str | None
    version: int
    status: PackageStatus
    customer: CustomerRef
    invoice_date: dt.date | None
    total: Money | None
    po_ref: str | None
    po_unreadable: bool
    blocking: list[Blocker]
    owner: UserRef
    problem_since: dt.datetime | None
    updated_at: dt.datetime


class PackagePage(BaseModel):
    items: list[PackageListItem]
    next_cursor: str | None
    total_count: int


class CurrencyTotal(BaseModel):
    total: Money
    package_count: int


class TopIssue(BaseModel):
    category: str
    rule_ids: list[str]
    package_count: int
    invoice_numbers: list[str]


class RuleCount(BaseModel):
    rule_id: str
    fail: int
    unknown: int


class LongestProblem(BaseModel):
    package: PackageRef
    days: int


class ProblemAge(BaseModel):
    average_days: str  # "3.0"
    longest: LongestProblem | None


class TaskProgress(BaseModel):
    resolved: int
    total: int


class RecentApproval(BaseModel):
    package: PackageRef
    version: int
    approver: UserRef
    approved_at: dt.datetime
    total: Money
    valid: bool
    exported: bool


class Dashboard(BaseModel):
    as_of: dt.datetime
    package_count: int
    customer_count: int
    status_counts: dict[str, int]
    open_problem_amounts: list[CurrencyTotal]
    ready_amounts: list[CurrencyTotal]
    top_issue: TopIssue | None
    rule_counts: list[RuleCount]
    problem_age: ProblemAge
    tasks: TaskProgress
    recent_approvals: list[RecentApproval]
