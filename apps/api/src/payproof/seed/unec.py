"""ADR-0011 demo: UNEC's two grant settlements (fixtures/scenarios/unec.json) as configured
packages — documents, generic extractions with evidence, and the first validation run computed
by the check library (QR-2026-0914 READY_FOR_APPROVAL, QR-2026-0927 NEEDS_FIX on U-07)."""

from collections import Counter
from collections.abc import Sequence
from pathlib import PurePath
from typing import Any

from payproof.domain.checks.engine import ENGINE_VERSION, EvalContext, evaluate
from payproof.extraction.generic import GenericData, validate_generic
from payproof.extraction.generic_persist import WHOLE
from payproof.repositories.models import (
    AuditEvent,
    CheckResult,
    Document,
    DocumentVersion,
    EvidenceRef,
    GenericExtraction,
    InvoicePackage,
    ValidationRun,
)
from payproof.repositories.orm import Base
from payproof.seed.files import placeholder
from payproof.seed.fixtures import CUSTOMERS, load, uid
from payproof.seed.identity import COMPANY_ID, rule_set_id
from payproof.seed.packages import MIME, ts

SCENARIO = load("scenarios/unec.json")
REGISTRY = {t["key"]: t for t in load("config/document-types.json")}


def version_id(doc_slug: str) -> Any:
    return uid(f"{doc_slug}:v1")


def _engine_doc(d: dict[str, Any]) -> dict[str, Any]:
    return {**d, "id": str(version_id(d["id"]))}  # the engine sees version ids, as at runtime


def unec_rows() -> list[Sequence[Base]]:
    customer = SCENARIO["customer"]["id"]
    rs = CUSTOMERS[customer]["requirement_sets"][-1]
    packages: list[Base] = []
    documents: list[Base] = []
    versions: list[Base] = []
    extractions: list[Base] = []
    evidence: list[Base] = []
    runs: list[Base] = []
    events: list[Base] = []
    results: list[Base] = []
    engine_pkgs = [{**p, "id": str(uid(p["id"])), "customer_id": str(uid(customer)),
                    "documents": [_engine_doc(d) for d in p["documents"]]}
                   for p in SCENARIO["packages"]]  # fmt: skip
    names = {k: t["name"] for k, t in REGISTRY.items()}
    for p, engine_pkg in zip(SCENARIO["packages"], engine_pkgs, strict=True):
        created = ts(p["created_at"])
        packages.append(InvoicePackage(
            id=uid(p["id"]), company_id=COMPANY_ID, customer_id=uid(customer),
            reference=p["reference"], currency=p["currency"], owner_id=uid(p["owner_id"]),
            version=1, created_at=created, updated_at=created,
        ))  # fmt: skip
        positions: Counter[str] = Counter()
        for d in p["documents"]:
            positions[d["type"]] += 1
            v_id = version_id(d["id"])
            documents.append(Document(id=uid(d["id"]), company_id=COMPANY_ID,
                                      package_id=uid(p["id"]), type=d["type"],
                                      position=positions[d["type"]]))  # fmt: skip
            versions.append(DocumentVersion(
                id=v_id, company_id=COMPANY_ID, document_id=uid(d["id"]), version_no=1,
                file_name=d["file_name"], storage_key=f"demo/{d['id']}/v1/{d['file_name']}",
                sha256=d["sha256"], mime=MIME[PurePath(d["file_name"]).suffix.lower()],
                size=len(placeholder(d["file_name"])), pages=d["pages"], source_kind="pdf",
                status="EXTRACTED", uploaded_by=uid(d["uploaded_by"]),
                package_version_at_upload=1, created_at=ts(d["uploaded_at"]),
            ))  # fmt: skip
            data = GenericData(d["fields"], d["unreadable"], d["tables"], d["evidence"])
            validate_generic(data, REGISTRY[d["type"]]["extraction"], d["pages"])
            extractions.append(GenericExtraction(
                company_id=COMPANY_ID, document_version_id=v_id, document_type=d["type"],
                document_type_version=REGISTRY[d["type"]]["version"], fields=d["fields"],
                unreadable=d["unreadable"], tables=d["tables"], evidence=d["evidence"],
                source="seed",
            ))  # fmt: skip
            cited = {**d["evidence"], WHOLE: {"page": 1, "quote": d["file_name"]}}
            evidence += [EvidenceRef(id=uid(f"{d['id']}:ev:{k}"), company_id=COMPANY_ID,
                                     document_version_id=v_id, field_path=k, page=e["page"],
                                     quote=e["quote"]) for k, e in cited.items()]  # fmt: skip
        run_id = uid(f"{p['id']}:run:v1")
        runs.append(ValidationRun(
            id=run_id, company_id=COMPANY_ID, customer_id=uid(customer), package_id=uid(p["id"]),
            package_version=1, requirement_set_id=rule_set_id(customer, rs["version"]),
            engine_version=ENGINE_VERSION, created_at=created,
        ))  # fmt: skip
        events.append(AuditEvent(
            id=uid(f"{p['id']}:audit:created"), company_id=COMPANY_ID, created_at=created,
            actor_id=uid(p["owner_id"]), action="package.created", object_type="package",
            object_id=uid(p["id"]), package_id=uid(p["id"]), package_version=1,
            message=f"{p['reference']}: hesabat paketi {len(p['documents'])} sənədlə yaradıldı",
        ))  # fmt: skip
        slugs = {str(version_id(d["id"])): d["id"] for d in p["documents"]}
        for r in evaluate(engine_pkg, rs, EvalContext(others=engine_pkgs, names=names)):
            ev_ids = list(dict.fromkeys(uid(f"{slugs[e['document_id']]}:ev:{e['field']}")
                                        for e in r["evidence"]))  # fmt: skip
            results.append(CheckResult(
                company_id=COMPANY_ID, validation_run_id=run_id, rule_id=r["rule_id"],
                check_type=r["check_type"], outcome=r["outcome"], cascade=False,
                message=r["message"], data=r["data"], evidence_ids=ev_ids,
            ))  # fmt: skip
    return [packages, documents, versions, extractions + evidence, runs, results, events]
