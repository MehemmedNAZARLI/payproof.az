"""ADR-0011 validation of a configured package: current document versions + their stored generic
extractions → the check library (domain/checks) → a validation run with its results.

Evidence of a result is linked to the evidence rows written with the extraction, by
(document version, cited key); the document id the engine sees *is* the version id."""

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.domain.checks.engine import ENGINE_VERSION, EvalContext, evaluate
from payproof.domain.enums import CheckOutcome
from payproof.domain.rules.result import CheckResult as DomainResult
from payproof.repositories.models import (
    CheckResult,
    Document,
    DocumentVersion,
    EvidenceRef,
    GenericExtraction,
    InvoicePackage,
    RequirementSet,
    ValidationRun,
)
from payproof.services.requirement_config import type_names

Json = dict[str, Any]


async def generic_package(
    session: AsyncSession, pkg: InvoicePackage, rs: RequirementSet
) -> Json | None:
    """The package in the check library's shape; None while a current version is unextracted."""
    order = {d["type"]: i for i, d in enumerate(rs.documents or [])}
    docs = sorted(
        (await session.scalars(select(Document).where(Document.package_id == pkg.id))).all(),
        key=lambda d: (order.get(d.type, len(order)), d.type, d.position),
    )
    versions = (
        await session.scalars(
            select(DocumentVersion).where(DocumentVersion.document_id.in_([d.id for d in docs]))
        )
    ).all()
    current: dict[uuid.UUID, DocumentVersion] = {}
    for version in sorted(versions, key=lambda x: x.version_no):
        current[version.document_id] = version  # latest version wins
    extractions = {
        e.document_version_id: e
        for e in await session.scalars(
            select(GenericExtraction).where(
                GenericExtraction.document_version_id.in_([v.id for v in current.values()])
            )
        )
    }
    out: list[Json] = []
    for d in docs:
        v = current.get(d.id)
        e = extractions.get(v.id) if v else None
        if v is None or e is None:
            return None
        out.append({"id": str(v.id), "type": d.type, "file_name": v.file_name,
                    "pages": v.pages or 1, "fields": e.fields, "unreadable": e.unreadable,
                    "tables": e.tables, "evidence": e.evidence})  # fmt: skip
    return {"id": str(pkg.id), "reference": pkg.reference, "customer_id": str(pkg.customer_id),
            "currency": pkg.currency, "documents": out}  # fmt: skip


async def _others(session: AsyncSession, pkg: InvoicePackage, rs: RequirementSet) -> list[Json]:
    """The customer's configured packages (no_duplicate_use with scope `customer`)."""
    rows = await session.scalars(
        select(InvoicePackage).where(
            InvoicePackage.customer_id == pkg.customer_id,
            InvoicePackage.reference.is_not(None),
            InvoicePackage.deleted_at.is_(None),
        )
    )
    return [g for p in rows.all() if (g := await generic_package(session, p, rs)) is not None]


async def run_generic(
    session: AsyncSession, pkg: InvoicePackage, rs: RequirementSet
) -> tuple[ValidationRun, list[DomainResult]] | None:
    p = await generic_package(session, pkg, rs)
    if p is None:
        return None
    ctx = EvalContext(others=await _others(session, pkg, rs), names=await type_names(session))
    results = evaluate(p, {"documents": rs.documents, "checks": rs.checks}, ctx)
    run = ValidationRun(
        company_id=pkg.company_id, customer_id=pkg.customer_id, package_id=pkg.id,
        package_version=pkg.version, requirement_set_id=rs.id, engine_version=ENGINE_VERSION,
    )  # fmt: skip
    session.add(run)
    await session.flush()
    versions = [uuid.UUID(d["id"]) for d in p["documents"]]
    ids = {
        (str(r.document_version_id), r.field_path): r.id
        for r in await session.scalars(
            select(EvidenceRef).where(EvidenceRef.document_version_id.in_(versions))
        )
    }
    session.add_all(
        CheckResult(
            company_id=pkg.company_id,
            validation_run_id=run.id,
            rule_id=r["rule_id"],
            check_type=r["check_type"],
            outcome=r["outcome"],
            cascade=r["cascade"],
            message=r["message"],
            fix_hint=None,
            data=r["data"],
            evidence_ids=list(
                dict.fromkeys(
                    ids[k] for e in r["evidence"] if (k := (e["document_id"], e["field"])) in ids
                )
            ),
        )
        for r in results
    )
    domain = [
        DomainResult(r["rule_id"], CheckOutcome(r["outcome"]), r["message"], data=r["data"])
        for r in results
    ]
    return run, domain
