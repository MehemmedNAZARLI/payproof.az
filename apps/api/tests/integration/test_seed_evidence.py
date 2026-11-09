from sqlalchemy.ext.asyncio import AsyncSession

from payproof.domain.enums import Role
from payproof.repositories.base import bind_tenant
from payproof.seed.cli import seed
from payproof.seed.fixtures import uid
from payproof.seed.identity import COMPANY_ID
from payproof.services.package_detail import package_detail


async def test_seeded_detail_shows_evidence_for_fields_checks_and_cells(db: AsyncSession) -> None:
    await seed(db)
    bind_tenant(db, COMPANY_ID)
    detail = await package_detail(db, uid("pkg_1047"), viewer_role=Role.OPERATOR)

    po = next(f for f in detail.fields if f.field_path == "invoice.po_ref")
    assert po.evidence is not None and po.evidence.quote == "Sifariş №: PO-3?7 (oxunmur)"
    r001 = next(c for c in detail.checks if c.rule_id == "R-001")
    assert [e.quote for e in r001.evidence] == ["Sifariş №: PO-3?7 (oxunmur)"]
    delivery = next(c for c in detail.checks if c.rule_id == "R-007")  # delivery required
    assert [e.quote for e in delivery.evidence] == ["Əsas: sifariş PO-397"]
    cells = [c for row in detail.comparison.rows for c in (row.invoice, row.delivery)]
    assert sum(c.evidence is not None for c in cells) >= 4
