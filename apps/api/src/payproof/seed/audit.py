"""Demo audit trail derived from fixtures (port of the mock/prototype `seed()`): package created
-> documents -> extraction -> order link -> approvals/exports -> tasks -> validation run."""

import datetime as dt
from dataclasses import dataclass
from functools import cache

from payproof.domain.enums import CheckOutcome
from payproof.repositories.models import AuditEvent
from payproof.seed.fixtures import CUSTOMERS, PACKAGES, Fixture, load, outcome_of, rule_set, uid
from payproof.seed.identity import COMPANY_ID

DOC_LABEL = {"invoice": "Faktura", "order": "Sifariş", "delivery": "Təhvil sənədi"}


@dataclass(frozen=True)
class _Event:
    at: dt.datetime
    actor: str | None  # fixture user slug; None = system
    action: str
    message: str
    package: str | None
    object_type: str = "package"


def _ts(value: str, minutes: int = 0) -> dt.datetime:
    return dt.datetime.fromisoformat(value) + dt.timedelta(minutes=minutes)


def _documents(p: Fixture) -> list[_Event]:
    return [
        _Event(
            at=_ts(v["uploaded_at"]),
            actor=v["uploaded_by"],
            action="document.uploaded",
            message=f"{DOC_LABEL[d['type']]}: {v['file_name']} (sənəd v{v['version_no']})",
            package=p["id"],
            object_type="document_version",
        )
        for d in p["documents"]
        for v in d["versions"]
    ]


def _link(p: Fixture) -> list[_Event]:
    link, created = p["order_link"], p["created_at"]
    if link["confirmed"]:
        exact = link["method"] == "exact_id"
        how = "təsdiqlənmiş ID" if exact else "insan təsdiqi"
        return [
            _Event(
                at=_ts(created, 4),
                actor=None if link["confirmed_by"] == "system" else link["confirmed_by"],
                action="link.exact_match" if exact else "link.confirmed",
                message=f"{link['po_number']} · üsul: {how}",
                package=p["id"],
                object_type="order_link",
            )
        ]
    if p["candidates"]:
        pos = ", ".join(c["po_number"] for c in p["candidates"])
        message = f"{pos} — insan seçimi gözlənilir"
        return [_Event(_ts(created, 3), None, "link.candidates_found", message, p["id"])]
    return []


def _approvals_and_exports(p: Fixture) -> list[_Event]:
    out = []
    for a in p["approvals"]:
        version = f"v{a['package_version']}"
        message = f"{version} · qayda dəsti v{a['requirement_set_version']}"
        out.append(
            _Event(_ts(a["created_at"]), a["approver_id"], "approval.created", message,
                   p["id"], "approval")
        )  # fmt: skip
        if not a["valid"] and a.get("invalidated_at"):
            reason = (a.get("invalidated_reason") or "").lower()
            message = (
                f"{version} təsdiqi qüvvədən düşdü: {reason}. Əvvəlki təsdiq auditdə saxlanılır."
            )
            out.append(
                _Event(_ts(a["invalidated_at"]), None, "approval.invalidated", message,
                       p["id"], "approval")
            )  # fmt: skip
    for e in p["exports"]:
        message = f"v{e['package_version']} · manifest: {', '.join(e['files'])}"
        out.append(
            _Event(_ts(e["created_at"]), e["created_by"], "export.created", message,
                   p["id"], "export")
        )  # fmt: skip
    return out


def _package_events(p: Fixture) -> list[_Event]:
    customer = CUSTOMERS[p["customer_id"]]["name"]
    created = _Event(
        _ts(p["created_at"]),
        p["owner_id"],
        "package.created",
        f"{p['invoice_number']} · {customer}",
        p["id"],
    )
    out = [created, *_documents(p)]
    if p["processing"]:
        return out
    extracted = (
        "Skan: PO sahəsi oxunmadı — insan yoxlaması tələb olunur"
        if p["invoice"]["unreadable_fields"]
        else "Sahələr və mənbə istinadları çıxarıldı (əvvəlcədən hazırlanmış nəticə)"
    )
    out.append(_Event(_ts(p["created_at"], 2), None, "document.extracted", extracted, p["id"]))
    return out + _link(p) + _approvals_and_exports(p)


def _tasks() -> list[_Event]:
    users = {u["id"]: u["full_name"] for u in load("users.json")}
    out = []
    for t in load("tasks.json"):
        number, rule, pkg = t["number"], t["rule_id"], t["package_id"]
        message = f"{number} · {rule} · məsul: {users[t['assignee_id']]}"
        out.append(
            _Event(_ts(t["created_at"]), t["created_by"], "task.created", message, pkg, "task")
        )
        if t["resolved_at"]:
            message = f"{number}: {rule} yoxlaması keçdi"
            out.append(_Event(_ts(t["resolved_at"]), None, "task.resolved", message, pkg, "task"))
    return out


def _validation(p: Fixture) -> _Event:
    _, checks = outcome_of(p)
    n = {o: sum(c.outcome is o for c in checks) for o in CheckOutcome}
    first = (p["exports"] or p["approvals"] or [{}])[0].get("created_at")
    at = _ts(first, -3) if first else _ts(p["created_at"], 3)  # mock: (export|approval|+6) - 3
    message = (
        f"v{p['version']} · qayda dəsti v{rule_set(p)['version']} · "
        f"{n[CheckOutcome.PASS]} keçdi, {n[CheckOutcome.FAIL]} uyğunsuz, "
        f"{n[CheckOutcome.UNKNOWN]} naməlum, {n[CheckOutcome.NOT_APPLICABLE]} tətbiq olunmur"
    )
    return _Event(at, None, "validation.run", message, p["id"], "validation_run")


@cache
def _events() -> tuple[_Event, ...]:
    out: list[_Event] = []
    for p in PACKAGES.values():
        out += _package_events(p)
    out += _tasks()
    out += [_validation(p) for p in PACKAGES.values() if not p["processing"]]
    return tuple(sorted(out, key=lambda e: e.at))  # stable: same-time events keep their order


def last_event_at(package_slug: str) -> dt.datetime:
    """A package's updated_at = its latest audit event (as the mock store derives it)."""
    return max(e.at for e in _events() if e.package == package_slug)


def audit_rows() -> list[AuditEvent]:
    version = {p["id"]: p["version"] for p in PACKAGES.values()}
    return [
        AuditEvent(
            id=uid(f"audit:{i}"),
            company_id=COMPANY_ID,
            created_at=e.at,
            actor_id=uid(e.actor) if e.actor else None,
            action=e.action,
            message=e.message,
            object_type=e.object_type,
            package_id=uid(e.package) if e.package else None,
            package_version=version.get(e.package) if e.package else None,
        )
        for i, e in enumerate(_events())
    ]
