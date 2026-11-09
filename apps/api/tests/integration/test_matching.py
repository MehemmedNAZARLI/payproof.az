from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.base import bind_tenant
from payproof.repositories.models import InvoicePackage
from payproof.seed.cli import seed
from payproof.seed.fixtures import PACKAGES, uid
from payproof.seed.identity import COMPANY_ID
from payproof.services.matching import candidates


async def test_unlinked_packages_get_the_fixture_candidates(db: AsyncSession) -> None:
    """Golden: suggestions for every package with an unconfirmed link (fixtures/packages.json)."""
    await seed(db)
    bind_tenant(db, COMPANY_ID)
    for number, p in PACKAGES.items():
        if p["processing"]:
            continue
        pkg = await db.get_one(InvoicePackage, uid(p["id"]))
        got = [c.order.po_number for c in await candidates(db, pkg)]
        linked = p["order_link"]["confirmed"]
        assert got == ([] if linked else [c["po_number"] for c in p["candidates"]]), number


async def test_inv_1048_gets_two_candidates_with_reasons(db: AsyncSession) -> None:
    await seed(db)
    bind_tenant(db, COMPANY_ID)
    found = await candidates(db, await db.get_one(InvoicePackage, uid("pkg_1048")))
    assert [(c.order.po_number, c.total) for c in found] == [
        ("PO-383", Decimal("1872.00")),
        ("PO-384", Decimal("1872.00")),
    ]  # contract example
    assert [c.reason for c in found] == [
        "Alıcı, məhsul kodu KY-200 və miqdar (520) uyğundur. Sifariş tarixi: 29.10.2026.",
        "Alıcı, məhsul kodu KY-200 və miqdar (520) uyğundur. Sifariş tarixi: 01.11.2026. "
        "TS-5541 təhvil aktı bu sifarişə istinad edir.",
    ]
