import datetime as dt

from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.models import ApprovalRecord, ExportRecord, ValidationRun
from tests.integration.factories import Tenant, add, add_fails, make_run

FILES = [{"document_version_id": "00000000-0000-0000-0000-000000000001", "type": "invoice"}]


def _approval(run: ValidationRun, t: Tenant, **over: object) -> ApprovalRecord:
    fields: dict[str, object] = {
        "validation_run_id": run.id,
        "package_id": run.package_id,
        "package_version": run.package_version,
        "requirement_set_id": run.requirement_set_id,
        "approver_id": t.user.id,
    }
    fields.update(over)
    return ApprovalRecord(company_id=run.company_id, **fields)


def _invalidated(approval: ApprovalRecord) -> None:
    approval.valid = False
    approval.invalidated_at = dt.datetime.now(dt.UTC)
    approval.invalidated_reason = "Paket v2-yə yeniləndi"


async def test_one_valid_approval_per_version(db: AsyncSession, a: Tenant) -> None:
    run = await make_run(db, a)
    first = _approval(run, a)
    await add(db, first)
    await db.refresh(first)
    assert first.valid is True
    await add_fails(db, _approval(run, a))
    _invalidated(first)  # e.g. after a rule set change; stays in the audit trail
    await db.flush()
    await add(db, _approval(run, a))


async def test_invalidation_needs_time_and_reason(db: AsyncSession, a: Tenant) -> None:
    run = await make_run(db, a)
    await add_fails(db, _approval(run, a, valid=False))
    now = dt.datetime.now(dt.UTC)
    await add_fails(db, _approval(run, a, valid=False, invalidated_at=now))
    await add_fails(db, _approval(run, a, invalidated_at=now, invalidated_reason="x"))


async def test_approval_matches_its_validation_run(db: AsyncSession, a: Tenant) -> None:
    run = await make_run(db, a)
    other = await make_run(db, a)
    await add_fails(db, _approval(run, a, package_version=2))  # run was for v1
    await add_fails(db, _approval(run, a, package_id=other.package_id))
    await add_fails(db, _approval(run, a, requirement_set_id=other.requirement_set_id))


async def test_approver_must_be_member(db: AsyncSession, a: Tenant, b: Tenant) -> None:
    await add_fails(db, _approval(await make_run(db, a), a, approver_id=b.user.id))


def _export(approval: ApprovalRecord, t: Tenant, **over: object) -> ExportRecord:
    fields: dict[str, object] = {
        "package_id": approval.package_id,
        "package_version": approval.package_version,
        "approval_id": approval.id,
        "files": FILES,
        "manifest_key": f"exports/{approval.id}.zip",
        "created_by": t.user.id,
    }
    fields.update(over)
    return ExportRecord(company_id=approval.company_id, **fields)


async def test_one_export_per_approved_version(db: AsyncSession, a: Tenant) -> None:
    approval = _approval(await make_run(db, a), a)
    await add(db, approval)
    await add(db, _export(approval, a))
    await add_fails(db, _export(approval, a, manifest_key="again"))


async def test_export_needs_files_and_matching_approval(db: AsyncSession, a: Tenant) -> None:
    approval = _approval(await make_run(db, a), a)
    await add(db, approval)
    await add_fails(db, _export(approval, a, files=[]))
    await add_fails(db, _export(approval, a, package_version=2))
