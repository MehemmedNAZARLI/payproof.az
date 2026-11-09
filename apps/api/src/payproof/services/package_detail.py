"""GET /v1/packages/{id}: everything the package screen needs, for one viewer
(port of the mock `packageDetail`). Permissions are role AND state; the server re-checks."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.errors import NotFound
from payproof.domain.enums import CheckOutcome, Currency, PackageStatus, Role
from payproof.domain.money import Money as DomainMoney
from payproof.domain.permissions import Permission, can
from payproof.domain.rules.catalog import TITLES
from payproof.domain.rules.engine import evaluate
from payproof.domain.snapshot import EvidenceRef
from payproof.repositories import detail_reads as dr
from payproof.repositories import package_reads as reads
from payproof.repositories.models import InvoicePackage, RequirementSet, User
from payproof.schemas import detail as d
from payproof.schemas.auth import UserRef
from payproof.schemas.packages import Blocker, CustomerRef, Money
from payproof.services import detail_parts as parts
from payproof.services import matching
from payproof.services.comparison import comparison_rows
from payproof.services.package_query import load_states
from payproof.services.snapshot_builder import build_snapshot

_DELETABLE = (PackageStatus.PROCESSING, PackageStatus.NEEDS_FIX, PackageStatus.NEEDS_REVIEW)


async def package_detail(
    session: AsyncSession, package_id: uuid.UUID, *, viewer_role: Role
) -> d.PackageDetail:
    states = await load_states(session, [package_id])
    if not states:
        raise NotFound  # also for another tenant's package
    st = states[0]
    p = st.package
    docs = await dr.documents(session, p.id)
    approvals, exports, tasks = (
        await dr.approvals(session, p.id),
        await dr.exports(session, p.id),
        await dr.tasks(session, p.id),
    )
    rule_set = await session.get(RequirementSet, st.rule_set_id) if st.rule_set_id else None
    if rule_set is None:
        raise NotFound  # every customer has a rule set; missing means inconsistent data
    rs_versions = await dr.rule_set_versions(
        session, {a.requirement_set_id for a in approvals} | {rule_set.id}
    )
    user_ids = {rule_set.approved_by, *(a.approver_id for a in approvals)}
    user_ids |= {e.created_by for e in exports} | {v.uploaded_by for _, vs in docs for v in vs}
    user_ids |= {t.assignee_id for t in tasks} | {t.created_by for t in tasks}
    if p.link_confirmed_by:
        user_ids.add(p.link_confirmed_by)
    users = await reads.owners(session, user_ids)

    def ref(user_id: uuid.UUID) -> UserRef:
        user, role = users[user_id]
        return _user_ref(user, role)

    fields, field_ids = await parts.fields(session, st)
    snapshot = await build_snapshot(session, st)
    found = snapshot.evidence if snapshot else {}

    def evidence(path: str) -> d.Evidence | None:
        return _evidence(found[path]) if path in found else None

    fields = [f.model_copy(update={"evidence": evidence(f.field_path)}) for f in fields]
    # shortcut: a check's evidence comes from the engine on the current snapshot (same data
    # as the stored run); read check_results.evidence_ids once B-17 writes them
    by_rule = {c.rule_id: c.evidence for c in evaluate(snapshot)} if snapshot else {}
    descriptions = await dr.descriptions(session, p.order_id) if p.order_id else {}
    approval_by_id = {a.id: a for a in approvals}
    current = next(
        (a for a in approvals
         if a.valid and a.package_version == p.version and a.requirement_set_id == rule_set.id),
        None,
    )  # fmt: skip
    counts = {o: sum(1 for c in st.checks if c.outcome is o) for o in CheckOutcome}
    return d.PackageDetail(
        id=p.id,
        invoice_number=p.invoice_number,
        version=p.version,
        status=st.status,
        processing=p.processing,
        customer=CustomerRef(id=p.customer_id, name=st.customer_name),
        invoice_date=p.invoice_date,
        owner=_user_ref(st.owner, st.owner_role),
        created_at=p.created_at,
        updated_at=p.updated_at,
        total=Money.of(st.total) if st.total else None,
        requirement_set=d.RequirementSet(
            id=rule_set.id,
            version=rule_set.version,
            require_po=rule_set.require_po,
            require_delivery=rule_set.require_delivery,
            require_signature=rule_set.require_signature,
            tolerance=f"{rule_set.tolerance:.2f}",
            effective_from=rule_set.effective_from,
            approved_by=ref(rule_set.approved_by),
            reason=rule_set.reason,
            created_at=rule_set.created_at,
        ),
        link=d.OrderLink(
            confirmed=p.order_id is not None,
            order_id=p.order_id,
            order_po=st.order_po,
            method=p.link_method,
            confirmed_by=ref(p.link_confirmed_by) if p.link_confirmed_by else None,
            candidates=await match_candidates(session, p),
        ),
        documents=[parts.document(doc, versions, ref) for doc, versions in docs if versions],
        fields=fields,
        comparison=d.Comparison(
            rows=comparison_rows(
                snapshot, descriptions=descriptions, field_ids=field_ids, evidence=evidence
            )
            if snapshot and not p.processing
            else []
        ),
        checks=[
            d.CheckResult(
                rule_id=c.rule_id,
                title=TITLES[c.rule_id],
                outcome=c.outcome,
                cascade=c.cascade,
                message=c.message,
                evidence=[_evidence(e) for e in by_rule.get(c.rule_id, ())],
                fix_hint=c.fix_hint.value if c.fix_hint else None,
                data=dict(c.data),
            )
            for c in st.checks
        ],
        summary=d.CheckSummary(
            pass_=counts[CheckOutcome.PASS],
            fail=counts[CheckOutcome.FAIL],
            unknown=counts[CheckOutcome.UNKNOWN],
            not_applicable=counts[CheckOutcome.NOT_APPLICABLE],
            blocking=[Blocker(rule_id=b.rule_id, outcome=b.outcome.value) for b in st.blockers],
        ),
        current_approval=parts.approval(current, rs_versions, ref) if current else None,
        approvals=[parts.approval(a, rs_versions, ref) for a in approvals],
        exports=[
            d.ExportRecord(
                id=e.id,
                package_version=e.package_version,
                requirement_set_version=rs_versions[
                    approval_by_id[e.approval_id].requirement_set_id
                ],
                created_by=ref(e.created_by),
                created_at=e.created_at,
                files=[d.ExportFile(**f) for f in e.files],
            )
            for e in exports
        ],
        tasks=[parts.task(t, p.invoice_number or "", ref) for t in tasks],
        permissions=d.PackagePermissions(
            can_edit=can(viewer_role, Permission.EDIT_PACKAGE) and not p.processing,
            can_manage_tasks=can(viewer_role, Permission.MANAGE_TASKS),
            can_approve=can(viewer_role, Permission.APPROVE_PACKAGE)
            and st.status is PackageStatus.READY_FOR_APPROVAL,
            can_export=can(viewer_role, Permission.EXPORT_PACKAGE)
            and st.status is PackageStatus.APPROVED_READY,
            can_delete=can(viewer_role, Permission.DELETE_PACKAGE)
            and not approvals
            and st.status in _DELETABLE,
        ),
    )


async def match_candidates(session: AsyncSession, p: InvoicePackage) -> list[d.MatchCandidate]:
    return [
        d.MatchCandidate(
            order_id=c.order.id,
            po_number=c.order.po_number,
            order_date=c.order.order_date,
            total=Money.of(DomainMoney(c.total, Currency(c.order.currency))),
            reason=c.reason,
        )
        for c in await matching.candidates(session, p)
    ]


def _evidence(e: EvidenceRef) -> d.Evidence:
    bbox = list(e.bbox) if e.bbox else None
    return d.Evidence(
        document_version_id=e.document_version_id, page=e.page, quote=e.quote, bbox=bbox
    )


def _user_ref(user: User, role: Role) -> UserRef:
    return UserRef(id=user.id, full_name=user.full_name, title=user.title, role=role)
