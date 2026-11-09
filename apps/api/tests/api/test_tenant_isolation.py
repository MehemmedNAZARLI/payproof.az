"""Every write endpoint, given another company's object, answers 404 — never 403, never a
change (security.md, B-26)."""

import datetime as dt
import uuid
from collections.abc import Callable
from typing import Any

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.models import (
    Document,
    ExtractedField,
    Notification,
    ResolutionTask,
)
from payproof.seed.files import placeholder
from payproof.seed.fixtures import uid
from tests.integration.factories import add, make_tenant, package, version

Auth = Callable[[str], dict[str, str]]
PDF = placeholder("x.pdf")


@pytest.fixture
async def foreign(seeded: AsyncSession) -> dict[str, uuid.UUID]:
    t = await make_tenant(seeded)
    pkg = package(t, "INV-F1")
    await add(seeded, pkg)
    doc = Document(company_id=t.company.id, package_id=pkg.id, type="invoice")
    await add(seeded, doc)
    v = version(doc, t)
    await add(seeded, v)
    field = ExtractedField(
        company_id=t.company.id, document_version_id=v.id, field_path="invoice.po_ref",
        raw_value="PO-1", normalized_value="PO-1",
    )  # fmt: skip
    task = ResolutionTask(
        company_id=t.company.id, number="T-1", package_id=pkg.id, rule_id="R-001",
        assignee_id=t.user.id, created_by=t.user.id, step="Düzəliş", due_date=dt.date(2030, 1, 1),
    )  # fmt: skip
    note = Notification(company_id=t.company.id, user_id=t.user.id, package_id=pkg.id, text="x")
    await add(seeded, field, task, note)
    return {"pkg": pkg.id, "doc": doc.id, "field": field.id, "task": task.id,
            "customer": t.customer.id, "note": note.id}  # fmt: skip


def _key() -> dict[str, str]:
    return {"Idempotency-Key": str(uuid.uuid4())}


CASES: list[tuple[str, str, str, dict[str, Any]]] = [
    # (method, path, user, request kwargs) — {pkg}, {doc}, … are the other company's ids
    ("POST", "/v1/packages/{pkg}/documents", "u1",
     {"data": {"type": "invoice", "expected_version": "1"}, "files": {"file": ("a.pdf", PDF)}}),
    ("POST", "/v1/documents/{doc}/versions", "u1",
     {"data": {"expected_version": "1"}, "files": {"file": ("a.pdf", PDF)}}),
    ("POST", "/v1/packages/{pkg}/matches", "u1",
     {"json": {"order_id": str(uid("PO-381")), "expected_version": 1}}),
    ("POST", "/v1/packages/{pkg}/validate", "u1", {"json": {"expected_version": 1}}),
    ("POST", "/v1/packages/{pkg}/signature-review", "u1", {"json": {"expected_version": 1}}),
    ("POST", "/v1/packages/{pkg}/tasks", "u1",
     {"json": {"rule_id": "R-001", "assignee_id": str(uid("u1")), "step": "Düzəliş",
               "due_date": "2030-01-01"}}),
    ("POST", "/v1/packages/{pkg}/approve", "u2",
     {"json": {"expected_version": 1, "expected_requirement_set_version": 1,
               "documents_reviewed": True}}),
    ("POST", "/v1/packages/{pkg}/export", "u1",
     {"json": {"expected_version": 1, "expected_requirement_set_version": 1,
               "document_version_ids": [str(uuid.uuid4())]}}),
    ("DELETE", "/v1/packages/{pkg}", "u1", {}),
    ("PATCH", "/v1/fields/{field}", "u1",
     {"json": {"value": "PO-2", "reason": "mənbəyə baxıldı", "expected_version": 1}}),
    ("PATCH", "/v1/tasks/{task}", "u1", {"json": {"status": "IN_PROGRESS"}}),
    ("DELETE", "/v1/tasks/{task}", "u1", {}),
    ("POST", "/v1/customers/{customer}/requirements", "u2",
     {"json": {"require_po": True, "require_delivery": True, "require_signature": True,
               "tolerance": "0.01", "effective_from": "2030-01-01",
               "reason": "Başqa şirkətin qaydası", "expected_version": 1}}),
    ("POST", "/v1/notifications/{note}/read", "u1", {}),
    ("POST", "/v1/packages", "u1",
     {"data": {"customer_id": "{customer}", "owner_id": str(uid("u1"))},
      "files": {"invoice": ("INV-1051.pdf", PDF)}}),
    ("GET", "/v1/packages/{pkg}", "u1", {}),
    ("GET", "/v1/packages/{pkg}/internal-report", "u1", {}),
]  # fmt: skip


@pytest.mark.parametrize(
    ("method", "path", "user", "kwargs"), CASES, ids=[f"{c[0]} {c[1]}" for c in CASES]
)
async def test_another_companys_object_is_not_found(
    client: httpx.AsyncClient,
    auth: Auth,
    foreign: dict[str, uuid.UUID],
    method: str,
    path: str,
    user: str,
    kwargs: dict[str, Any],
) -> None:
    ids = {k: str(v) for k, v in foreign.items()}
    if "data" in kwargs:
        kwargs = {**kwargs, "data": {k: v.format(**ids) for k, v in kwargs["data"].items()}}
    r = await client.request(method, path.format(**ids), headers={**auth(user), **_key()}, **kwargs)
    assert r.status_code == 404, r.text
