from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.extraction.previous import extraction_input
from payproof.repositories.base import bind_tenant
from payproof.repositories.models import DocumentVersion, InvoicePackage
from payproof.seed.cli import seed
from payproof.seed.fixtures import uid
from payproof.seed.identity import COMPANY_ID
from payproof.seed.packages import version_id


async def test_input_carries_the_current_extraction(db: AsyncSession) -> None:
    await seed(db)
    bind_tenant(db, COMPANY_ID)
    pkg = await db.get_one(InvoicePackage, uid("pkg_1047"))
    version = (
        await db.scalars(
            select(DocumentVersion).where(
                DocumentVersion.id == version_id("pkg_1047", "invoice", 1)
            )
        )
    ).one()
    got = await extraction_input(db, version, pkg, "invoice", b"x")
    assert got.scanned and got.doc_type == "invoice"
    assert got.invoice is not None and "invoice.po_ref" in got.invoice.unreadable
    assert got.invoice.lines and all(li.unit for li in got.invoice.lines)
    assert "VÖEN" in got.customer
