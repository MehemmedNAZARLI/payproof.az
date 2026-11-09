import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.errors import Conflict, PackageNotReady
from payproof.repositories.base import bind_tenant
from payproof.seed.cli import seed
from payproof.seed.fixtures import uid
from payproof.seed.identity import COMPANY_ID
from payproof.services.approval import Approved, approve


async def test_check_order(db: AsyncSession) -> None:
    await seed(db)
    bind_tenant(db, COMPANY_ID)

    async def go(pkg: str, version: int = 1, rules: int = 2) -> Approved:
        return await approve(
            db, actor_id=uid("u2"), package_id=uid(pkg), expected_version=version,
            expected_rule_set_version=rules,
        )  # fmt: skip

    with pytest.raises(Conflict, match="v1"):
        await go("pkg_1038", version=2)  # stale version before anything else
    with pytest.raises(PackageNotReady):
        await go("pkg_1042")
    first = await go("pkg_1038")
    second = await go("pkg_1038")
    assert first.created and not second.created
    assert first.approval.id == second.approval.id
