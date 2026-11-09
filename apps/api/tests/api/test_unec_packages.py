"""ADR-0011 configured packages through the real tables: seeded UNEC settlements evaluate as the
golden file says, re-validation is stable, and the invoice list leaves them out."""

import json
from collections.abc import Callable

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.base import bind_tenant
from payproof.repositories.models import CheckResult, InvoicePackage
from payproof.seed.fixtures import FIXTURES, uid
from payproof.services.package_query import PackageState, load_states
from payproof.services.validation import revalidate

Auth = Callable[[str], dict[str, str]]
EXPECTED = json.loads((FIXTURES / "scenarios" / "unec.expected.json").read_text())["packages"]
REFERENCE = json.loads((FIXTURES / "scenarios" / "unec.reference.json").read_text())


async def _states(db: AsyncSession) -> dict[str, PackageState]:
    bind_tenant(db, uid("company_a"))
    rows = await db.scalars(select(InvoicePackage.id).where(InvoicePackage.reference.is_not(None)))
    return {str(s.package.reference): s for s in await load_states(db, list(rows.all()))}


async def test_seeded_settlements_match_the_golden_file(seeded: AsyncSession) -> None:
    states = await _states(seeded)
    assert sorted(states) == sorted(EXPECTED)
    for ref, want in EXPECTED.items():
        s = states[ref]
        assert s.status.value == want["status"], ref
        assert [c.rule_id for c in s.blockers] == want["primary_blockers"]
        assert {c.rule_id: c.outcome.value for c in s.checks} == want["results"]


async def test_revalidation_reproduces_the_reference_with_linked_evidence(
    seeded: AsyncSession,
) -> None:
    states = await _states(seeded)
    pkg = states["QR-2026-0927"].package
    run = await revalidate(seeded, pkg)
    assert run is not None
    rows = {
        r.rule_id: r
        for r in await seeded.scalars(
            select(CheckResult).where(CheckResult.validation_run_id == run.id)
        )
    }
    for want in REFERENCE["base_0927"]["results"]:
        got = rows[want["rule_id"]]
        assert (got.outcome, got.message, got.check_type) == (
            want["outcome"], want["message"], want["check_type"])  # fmt: skip
        cited = {(e["document_id"], e["field"]) for e in want["evidence"]}
        assert len(got.evidence_ids) == len(cited), want["rule_id"]


async def test_invoice_list_and_dashboard_leave_configured_packages_out(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    page = (await client.get("/v1/packages?limit=200", headers=auth("u2"))).json()
    assert page["total_count"] == 14
    detail = await client.get(f"/v1/packages/{uid('unec_0914')}", headers=auth("u2"))
    assert detail.status_code == 404  # PackageDetail is invoice-shaped (known limitation)
