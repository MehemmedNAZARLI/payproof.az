"""Golden flow INV-1042 (expected.json): confirm the link, then upload the corrected invoice."""

import datetime as dt
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from payproof.extraction.mock import MockExtractionAdapter
from payproof.extraction.pipeline import adapter_extractor
from payproof.repositories.base import bind_tenant
from payproof.repositories.models import CheckResult, EvidenceRef, InvoicePackage, ResolutionTask
from payproof.seed.cli import seed
from payproof.seed.fixtures import EXPECTED, uid
from payproof.seed.identity import COMPANY_ID
from payproof.services.linking import confirm_link
from payproof.services.package_query import PackageState, load_states
from payproof.services.snapshot_builder import build_snapshot
from payproof.services.upload import Upload, upload
from payproof.storage.s3 import get_storage
from payproof.worker.extract import extract_handler
from payproof.worker.queue import PostgresQueue
from payproof.worker.runner import run_once

STEPS = {s["step"]: s for s in EXPECTED["flows"]["INV-1042"]}


async def _state(db: AsyncSession) -> PackageState:
    [state] = await load_states(db, [uid("pkg_1042")])
    return state


def _matches(state: PackageState, step: dict[str, object]) -> None:
    blockers = [{"rule_id": b.rule_id, "outcome": b.outcome.value} for b in state.blockers]
    assert (state.status.value, state.package.version, blockers) == (
        step["status"],
        step["version"],
        step["blockers"],
    ), step["step"]


async def test_steps_1_to_5(db: AsyncSession) -> None:
    await seed(db)
    bind_tenant(db, COMPANY_ID)
    _matches(await _state(db), STEPS["initial"])
    # approve_blocked: the approval API is B-20; the blocked package stays as it is
    _matches(await _state(db), STEPS["approve_blocked"])

    step = STEPS["confirm_link"]
    await confirm_link(
        db, actor_id=uid("u1"), package_id=uid("pkg_1042"), order_id=uid("PO-381"),
        expected_version=1,
    )  # fmt: skip
    _matches(await _state(db), step)

    step = STEPS["create_tasks"]  # the task API is B-19: write the step's tasks directly
    tasks = {
        t["rule_id"]: ResolutionTask(
            company_id=COMPANY_ID, number=t["number"], package_id=uid("pkg_1042"),
            rule_id=t["rule_id"], assignee_id=uid(t["assignee_id"]), created_by=uid("u1"),
            step="Düzəliş", due_date=dt.date(2026, 11, 12), status=t["status"],
        )
        for t in step["tasks"]
    }  # fmt: skip
    db.add_all(tasks.values())
    await db.flush()
    task_ids = {rule: t.id for rule, t in tasks.items()}
    _matches(await _state(db), step)

    step = STEPS["upload_invoice"]
    pkg = await db.get_one(InvoicePackage, uid("pkg_1042"))
    await upload(
        db, get_storage(), actor_id=uid("u1"), package_id=pkg.id, doc_type="invoice",
        up=Upload(str(step["file_name"]), b"%PDF-1.7 " + uuid.uuid4().bytes, pkg.version),
        endpoint="uploadDocument", key=uuid.uuid4(),
    )  # fmt: skip
    sessions = async_sessionmaker(
        bind=await db.connection(), join_transaction_mode="create_savepoint", expire_on_commit=False
    )
    handler = extract_handler(adapter_extractor(MockExtractionAdapter(), get_storage()))
    assert await run_once(sessions, PostgresQueue(), {"extract_document": handler})
    db.expire_all()
    state = await _state(db)
    _matches(state, step)
    checks = {c.rule_id: c.outcome.value for c in state.checks}
    assert {k: checks[k] for k in step["checks"]} == step["checks"]
    statuses = {r: (await db.get_one(ResolutionTask, i)).status for r, i in task_ids.items()}
    assert statuses == {"R-001": "RESOLVED", "R-007": "OPEN"}  # only a passing rule resolves

    # evidence ids of the run point only at the run's own document versions
    assert state.run is not None
    rows = await db.scalars(
        select(CheckResult).where(CheckResult.validation_run_id == state.run.id)
    )
    cited = {i for r in rows for i in r.evidence_ids}
    owners = await db.scalars(
        select(EvidenceRef.document_version_id).where(EvidenceRef.id.in_(cited))
    )
    current = {v.document_version_id for v in (await build_snapshot(db, state)).evidence.values()}  # type: ignore[union-attr]
    assert cited and set(owners) <= current


async def test_exact_po_in_a_new_invoice_links_by_itself(db: AsyncSession) -> None:
    await seed(db)
    bind_tenant(db, COMPANY_ID)
    pkg = await db.get_one(InvoicePackage, uid("pkg_1042"))
    linked_before = pkg.order_id
    await upload(
        db, get_storage(), actor_id=uid("u1"), package_id=pkg.id, doc_type="invoice",
        up=Upload("INV-1042_v2_PO-381.pdf", b"%PDF-1.7 " + uuid.uuid4().bytes, pkg.version),
        endpoint="uploadDocument", key=uuid.uuid4(),
    )  # fmt: skip
    sessions = async_sessionmaker(
        bind=await db.connection(), join_transaction_mode="create_savepoint", expire_on_commit=False
    )
    handler = extract_handler(adapter_extractor(MockExtractionAdapter(), get_storage()))
    assert await run_once(sessions, PostgresQueue(), {"extract_document": handler})
    await db.refresh(pkg)
    assert linked_before is None
    assert (pkg.order_id, pkg.link_method, pkg.link_confirmed_by) == (
        uid("PO-381"),
        "exact_id",
        None,
    )
