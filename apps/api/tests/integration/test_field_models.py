import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.models import DocumentVersion, EvidenceRef, ExtractedField
from tests.integration.factories import Tenant, add, add_fails, make_version

PATH = "invoice.lines[KY-10].unit_price"


def _field(v: DocumentVersion, **over: object) -> ExtractedField:
    fields: dict[str, object] = {
        "field_path": PATH,
        "raw_value": "9,00",
        "normalized_value": "9.00",
    }
    fields.update(over)
    return ExtractedField(company_id=v.company_id, document_version_id=v.id, **fields)


def _evidence(v: DocumentVersion, **over: object) -> EvidenceRef:
    fields: dict[str, object] = {"field_path": PATH, "page": 1, "quote": "KY-10 ... 9,00"}
    fields.update(over)
    return EvidenceRef(company_id=v.company_id, document_version_id=v.id, **fields)


async def test_field_defaults_to_extracted(db: AsyncSession, a: Tenant) -> None:
    v = await make_version(db, a)
    field = _field(v)
    await add(db, field)
    await db.refresh(field)
    assert field.review_status == "EXTRACTED"


async def test_one_field_per_path(db: AsyncSession, a: Tenant) -> None:
    v = await make_version(db, a)
    await add(db, _field(v))
    await add_fails(db, _field(v))


async def test_correction_needs_member_and_reason(db: AsyncSession, a: Tenant, b: Tenant) -> None:
    v = await make_version(db, a)
    ok = {"review_status": "CORRECTED", "corrected_by": a.user.id}
    await add(db, _field(v, **ok, correction_reason="Sənəddə 9,00 yazılıb"))
    await add_fails(db, _field(v, field_path="a", **ok))  # no reason
    await add_fails(db, _field(v, field_path="b", **ok, correction_reason="ok"))  # too short
    await add_fails(db, _field(v, field_path="c", review_status="CORRECTED"))  # no corrector
    await add_fails(db, _field(v, field_path="d", corrected_by=a.user.id))  # not CORRECTED
    bad = {**ok, "corrected_by": b.user.id, "correction_reason": "Başqa şirkət"}
    await add_fails(db, _field(v, field_path="e", **bad))


async def test_unknown_review_status(db: AsyncSession, a: Tenant) -> None:
    v = await make_version(db, a)
    await add_fails(db, _field(v, review_status="OK"))


async def test_evidence_with_and_without_bbox(db: AsyncSession, a: Tenant) -> None:
    v = await make_version(db, a)
    await add(db, _evidence(v), _evidence(v, bbox=[0.1, 0.2, 0.3, 0.05]))


@pytest.mark.parametrize(
    "over", [{"page": 0}, {"bbox": [0.1, 0.2]}, {"bbox": {"x": 1}}], ids=["page", "len", "obj"]
)
async def test_evidence_checks(db: AsyncSession, a: Tenant, over: dict[str, object]) -> None:
    v = await make_version(db, a)
    await add_fails(db, _evidence(v, **over))


async def test_evidence_version_must_be_same_tenant(db: AsyncSession, a: Tenant, b: Tenant) -> None:
    v = await make_version(db, a)
    evidence = _evidence(v)
    evidence.company_id = b.company.id
    await add_fails(db, evidence)
