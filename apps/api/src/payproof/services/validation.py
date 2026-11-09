"""Re-validation: snapshot of the current version → deterministic engine → a new run with its
check results. The package status is derived from the latest run (package_query)."""

import uuid
from collections import Counter

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.domain.enums import CheckOutcome
from payproof.domain.rules.engine import ENGINE_VERSION, evaluate
from payproof.domain.snapshot import EvidenceRef as DomainEvidence
from payproof.repositories.models import (
    CheckResult,
    EvidenceRef,
    InvoicePackage,
    RequirementSet,
    ValidationRun,
)
from payproof.services import validation_effects as effects
from payproof.services.audit import record
from payproof.services.package_query import load_states
from payproof.services.snapshot_builder import build_snapshot


def _key(e: DomainEvidence) -> tuple[uuid.UUID, int, str]:
    return e.document_version_id, e.page, e.quote


async def revalidate(
    session: AsyncSession, pkg: InvoicePackage, actor_id: uuid.UUID | None = None
) -> ValidationRun | None:
    """None while nothing can be evaluated yet (processing, no invoice extraction).
    `actor_id`: who asked for it (POST /validate); None = the system after a change."""
    await session.flush()
    [state] = await load_states(session, [pkg.id])
    snapshot = await build_snapshot(session, state)
    if snapshot is None or state.rule_set_id is None:
        return None
    run = ValidationRun(
        company_id=pkg.company_id,
        customer_id=pkg.customer_id,
        package_id=pkg.id,
        package_version=pkg.version,
        requirement_set_id=state.rule_set_id,
        engine_version=ENGINE_VERSION,
    )
    session.add(run)
    await session.flush()
    versions = {e.document_version_id for e in snapshot.evidence.values()}
    ids = {
        (r.document_version_id, r.page, r.quote): r.id
        for r in await session.scalars(
            select(EvidenceRef).where(EvidenceRef.document_version_id.in_(versions))
        )
    }
    checks = evaluate(snapshot)
    session.add_all(
        CheckResult(
            company_id=pkg.company_id,
            validation_run_id=run.id,
            rule_id=c.rule_id,
            outcome=c.outcome.value,
            cascade=c.cascade,
            message=c.message,
            fix_hint=c.fix_hint.value if c.fix_hint else None,
            data=dict(c.data),
            # only evidence of this run's own document versions (see the model's shortcut)
            evidence_ids=[ids[k] for k in map(_key, c.evidence) if k in ids],
        )
        for c in checks
    )
    n = Counter(c.outcome for c in checks)
    summary = (
        f"{n[CheckOutcome.PASS]} keçdi, {n[CheckOutcome.FAIL]} uyğunsuz, "
        f"{n[CheckOutcome.UNKNOWN]} naməlum, {n[CheckOutcome.NOT_APPLICABLE]} tətbiq olunmur"
    )
    rs = await session.get_one(RequirementSet, state.rule_set_id)
    await record(
        session,
        actor_id=actor_id,
        action="validation.run",
        message=f"v{pkg.version} · qayda dəsti v{rs.version} · {summary}",
        object_type="validation_run",
        object_id=run.id,
        package=pkg,
    )
    await effects.settle_tasks(session, pkg, checks)
    await session.flush()
    [after] = await load_states(session, [pkg.id])
    await effects.status_changed(session, pkg, state.status, after.status, after.total)
    return run
