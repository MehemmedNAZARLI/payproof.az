from typing import Any

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.base import bind_tenant
from payproof.repositories.models import InvoicePackage
from payproof.seed.cli import seed
from payproof.seed.fixtures import uid
from payproof.seed.identity import COMPANY_ID
from payproof.services import events
from payproof.services.notifications import notify
from tests.api.test_contract import assert_matches


async def test_one_row_per_person_and_a_live_event_each(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    sent: list[dict[str, Any]] = []

    async def capture(_: AsyncSession, payload: dict[str, Any]) -> None:
        sent.append(payload)

    monkeypatch.setattr(events, "notify", capture)
    await seed(db)
    bind_tenant(db, COMPANY_ID)
    pkg = await db.get_one(InvoicePackage, uid("pkg_1038"))
    rows = await notify(db, pkg, [uid("u2"), uid("u2"), uid("u1")], "INV-1038 təsdiqinizi gözləyir")
    assert [n.user_id for n in rows] == [uid("u2"), uid("u1")]
    assert [p["event_id"] for p in sent] == [str(n.id) for n in rows]
    for p in sent:
        assert_matches("LiveEvent", p)
        assert p["type"] == "notification.created" and p["package_id"] == str(pkg.id)
