import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.models import CheckResult, Customer, Membership, ValidationRun
from tests.integration.factories import Tenant, add, add_fails, package
from tests.integration.factories import make_rules as _rules
from tests.integration.factories import make_run as _run


def _check(run: ValidationRun, rule_id: str = "R-001", **over: object) -> CheckResult:
    fields: dict[str, object] = {"outcome": "PASS", "message": "PO istinadı tapıldı"}
    fields.update(over)
    return CheckResult(
        company_id=run.company_id, validation_run_id=run.id, rule_id=rule_id, **fields
    )


async def test_check_result_defaults(db: AsyncSession, a: Tenant) -> None:
    check = _check(await _run(db, a))
    await add(db, check)
    await db.refresh(check)
    assert (check.cascade, check.data, check.evidence_ids) == (False, {}, [])


async def test_one_result_per_rule_and_run(db: AsyncSession, a: Tenant) -> None:
    run = await _run(db, a)
    await add(db, _check(run))
    await add_fails(db, _check(run))


@pytest.mark.parametrize(
    ("rule_id", "over"),
    [("R-011", {}), ("R-1", {}), ("R-002", {"outcome": "OK"}), ("R-002", {"data": [1]})],
    ids=["rule-range", "rule-format", "outcome", "data-object"],
)
async def test_check_result_checks(
    db: AsyncSession, a: Tenant, rule_id: str, over: dict[str, object]
) -> None:
    await add_fails(db, _check(await _run(db, a), rule_id, **over))


async def test_run_rules_must_belong_to_package_customer(db: AsyncSession, a: Tenant) -> None:
    other = Customer(company_id=a.company.id, name="C2", external_id="C2", voen="1305884421")
    await add(db, other)
    pkg = package(a)
    await add(db, pkg)
    other_rules = await _rules(db, Tenant(a.company, a.user, other))
    run = ValidationRun(
        company_id=a.company.id,
        customer_id=a.customer.id,
        package_id=pkg.id,
        package_version=1,
        requirement_set_id=other_rules.id,
        engine_version="1",
    )
    await add_fails(db, run)


async def test_run_rules_must_be_same_tenant(db: AsyncSession, a: Tenant, b: Tenant) -> None:
    await add(db, Membership(user_id=a.user.id, company_id=b.company.id, role="approver"))
    pkg = package(a)
    await add(db, pkg)
    other_rules = await _rules(db, Tenant(b.company, a.user, b.customer))
    run = ValidationRun(
        company_id=a.company.id,
        customer_id=a.customer.id,
        package_id=pkg.id,
        package_version=1,
        requirement_set_id=other_rules.id,
        engine_version="1",
    )
    await add_fails(db, run)
