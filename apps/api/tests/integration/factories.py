"""Minimal tenant graphs for constraint tests (demo data lives in fixtures/, loaded by B-09)."""

import datetime as dt
import itertools
from dataclasses import dataclass
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.models import (
    Company,
    Customer,
    Document,
    DocumentVersion,
    InvoicePackage,
    Membership,
    RequirementSet,
    User,
    ValidationRun,
)

_seq = itertools.count(1)


@dataclass
class Tenant:
    company: Company
    user: User  # an operator of `company`
    customer: Customer


async def add(db: AsyncSession, *objs: object) -> None:
    db.add_all(objs)
    await db.flush()


async def add_fails(db: AsyncSession, *objs: object) -> None:
    """Expect a constraint error; the savepoint keeps the session usable for more checks."""
    with pytest.raises(IntegrityError):
        async with db.begin_nested():
            await add(db, *objs)


async def make_tenant(db: AsyncSession) -> Tenant:
    n = next(_seq)
    company = Company(name=f"Şirkət {n}", voen=f"{1_700_000_000 + n}")
    user = User(email=f"user{n}@tenant.test", full_name=f"İstifadəçi {n}", title="Operator")
    await add(db, company, user)
    customer = Customer(
        company_id=company.id, name=f"Müştəri {n}", external_id=f"C-{n}", voen="1402375611"
    )
    await add(db, customer, Membership(user_id=user.id, company_id=company.id, role="operator"))
    return Tenant(company, user, customer)


def package(t: Tenant, number: str = "INV-1042", /, **over: object) -> InvoicePackage:
    fields: dict[str, object] = {
        "customer_id": t.customer.id,
        "invoice_number": number,
        "currency": "AZN",
        "invoice_date": dt.date(2026, 11, 3),
        "owner_id": t.user.id,
    }
    fields.update(over)
    return InvoicePackage(company_id=t.company.id, **fields)


async def make_document(db: AsyncSession, t: Tenant, type_: str = "invoice") -> Document:
    pkg = package(t)
    await add(db, pkg)
    doc = Document(company_id=t.company.id, package_id=pkg.id, type=type_)
    await add(db, doc)
    return doc


def version(doc: Document, t: Tenant, no: int = 1, /, **over: object) -> DocumentVersion:
    fields: dict[str, object] = {
        "version_no": no,
        "file_name": "INV-1042.pdf",
        "storage_key": f"{doc.id}/{no}",
        "sha256": "a" * 64,
        "mime": "application/pdf",
        "size": 1024,
        "pages": 1,
        "source_kind": "pdf",
        "uploaded_by": t.user.id,
        "package_version_at_upload": 1,
    }
    fields.update(over)
    return DocumentVersion(company_id=doc.company_id, document_id=doc.id, **fields)


async def make_version(db: AsyncSession, t: Tenant, type_: str = "invoice") -> DocumentVersion:
    doc = await make_document(db, t, type_)
    v = version(doc, t)
    await add(db, v)
    return v


async def make_rules(db: AsyncSession, t: Tenant) -> RequirementSet:
    rules = RequirementSet(
        company_id=t.company.id,
        customer_id=t.customer.id,
        version=next(_seq),  # unique per customer, so several rule sets can coexist
        require_po=True,
        require_delivery=True,
        require_signature=False,
        tolerance=Decimal("0.01"),
        effective_from=dt.date(2026, 6, 1),
        approved_by=t.user.id,
        reason="İlk qayda dəsti",
    )
    await add(db, rules)
    return rules


async def make_run(db: AsyncSession, t: Tenant) -> ValidationRun:
    """A fresh package (v1) of `t.customer` with one validation run under a new rule set."""
    pkg = package(t, f"INV-{next(_seq)}")
    await add(db, pkg)
    run = ValidationRun(
        company_id=t.company.id,
        customer_id=t.customer.id,
        package_id=pkg.id,
        package_version=1,
        requirement_set_id=(await make_rules(db, t)).id,
        engine_version="1",
    )
    await add(db, run)
    return run
