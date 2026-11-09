import datetime as dt
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.errors import Conflict, InvalidInput
from payproof.repositories.base import bind_tenant
from payproof.repositories.models import ApprovalRecord, AuditEvent, InvoicePackage, Notification
from payproof.seed.cli import seed
from payproof.seed.fixtures import uid
from payproof.seed.identity import COMPANY_ID
from payproof.services.package_query import load_states
from payproof.services.requirements import NewRules, create_rule_set


def _rules(signature: bool = True, version: int = 1) -> NewRules:
    return NewRules(
        require_po=True, require_delivery=True, require_signature=signature,
        tolerance=Decimal("0.01"), effective_from=dt.date(2026, 12, 1),
        reason="Müştəri dekabrdan imzalı təhvil aktı tələb edir.", expected_version=version,
    )  # fmt: skip


async def test_new_rule_set_bumps_unexported_packages_adr_0009(db: AsyncSession) -> None:
    await seed(db)
    bind_tenant(db, COMPANY_ID)
    c2 = uid("c2")
    exported_before = (await db.get_one(InvoicePackage, uid("pkg_1031"))).version

    rs = await create_rule_set(db, actor_id=uid("u2"), customer_id=c2, new=_rules())

    assert rs.version == 2
    [inv_1035] = await load_states(db, [uid("pkg_1035")])
    assert (inv_1035.package.version, inv_1035.status.value) == (2, "NEEDS_REVIEW")
    approval = await db.scalar(
        select(ApprovalRecord).where(ApprovalRecord.package_id == uid("pkg_1035"))
    )
    assert approval is not None and not approval.valid
    assert approval.invalidated_reason == "qayda dəsti v2 qüvvəyə mindi"
    invalidated = await db.scalar(
        select(AuditEvent)
        .where(
            AuditEvent.package_id == uid("pkg_1035"), AuditEvent.action == "approval.invalidated"
        )
        .order_by(AuditEvent.created_at.desc())
    )
    assert invalidated is not None  # the old approval stays in the audit
    note = await db.scalar(
        select(Notification)
        .where(
            Notification.package_id == uid("pkg_1035"), Notification.user_id == approval.approver_id
        )
        .order_by(Notification.created_at.desc())
    )
    assert note is not None and "qayda dəsti v2" in note.text
    [inv_1031] = await load_states(db, [uid("pkg_1031")])  # exported: untouched
    assert (inv_1031.package.version, inv_1031.status.value) == (exported_before, "EXPORTED")


async def test_stale_or_unchanged_rules_are_refused(db: AsyncSession) -> None:
    await seed(db)
    bind_tenant(db, COMPANY_ID)
    with pytest.raises(Conflict):
        await create_rule_set(db, actor_id=uid("u2"), customer_id=uid("c2"), new=_rules(version=5))
    with pytest.raises(InvalidInput, match="dəyişiklik yoxdur"):
        await create_rule_set(
            db, actor_id=uid("u2"), customer_id=uid("c2"), new=_rules(signature=False)
        )
