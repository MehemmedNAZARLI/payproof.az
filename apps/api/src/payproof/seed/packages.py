"""Orders, invoice packages, documents and document versions from fixtures."""

import datetime as dt
import uuid
from collections.abc import Sequence
from decimal import Decimal
from pathlib import PurePath

from payproof.domain.enums import PackageStatus
from payproof.repositories.models import (
    Document,
    DocumentVersion,
    InvoicePackage,
    Order,
    OrderLine,
)
from payproof.repositories.orm import Base
from payproof.seed.audit import last_event_at
from payproof.seed.files import placeholder
from payproof.seed.fixtures import ORDERS, PACKAGES, Fixture, load, outcome_of, uid
from payproof.seed.identity import COMPANY_ID

PRODUCTS = {p["code"]: p for p in load("products.json")}
MIME = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".csv": "text/csv",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
_PROBLEM = (PackageStatus.NEEDS_REVIEW, PackageStatus.NEEDS_FIX)


def ts(value: str) -> dt.datetime:
    return dt.datetime.fromisoformat(value)


def package_rows() -> list[Sequence[Base]]:
    orders = [_order(o) for o in ORDERS.values()]
    lines = [_order_line(o, li) for o in ORDERS.values() for li in o["lines"]]
    packages = [_package(p) for p in PACKAGES.values()]
    documents = [
        Document(id=uid(f"{p['id']}:{d['type']}"), company_id=COMPANY_ID,
                 package_id=uid(p["id"]), type=d["type"])
        for p in PACKAGES.values() for d in p["documents"]
    ]  # fmt: skip
    versions = [v for p in PACKAGES.values() for v in _versions(p)]
    return [orders, lines, packages, documents, versions]


def version_id(pkg: str, doc_type: str, no: int) -> uuid.UUID:
    return uid(f"{pkg}:{doc_type}:v{no}")


def _order(o: Fixture) -> Order:
    return Order(
        id=uid(o["po_number"]),
        company_id=COMPANY_ID,
        customer_id=uid(o["customer_id"]),
        po_number=o["po_number"],
        currency=o["currency"],
        order_date=dt.date.fromisoformat(o["order_date"]),
    )


def _order_line(o: Fixture, li: Fixture) -> OrderLine:
    product = PRODUCTS[li["product_code"]]
    return OrderLine(
        id=uid(f"{o['po_number']}:{li['product_code']}"),
        company_id=COMPANY_ID,
        order_id=uid(o["po_number"]),
        product_code=li["product_code"],
        description=product["description"],
        qty=Decimal(str(li["qty"])),
        unit=product["unit"],
        unit_price=Decimal(li["unit_price"]),
    )


def _package(p: Fixture) -> InvoicePackage:
    link = p["order_link"]
    status, _ = outcome_of(p)
    created = ts(p["created_at"])
    return InvoicePackage(
        id=uid(p["id"]),
        company_id=COMPANY_ID,
        customer_id=uid(p["customer_id"]),
        invoice_number=p["invoice_number"],
        currency=p["currency"],
        invoice_date=dt.date.fromisoformat(p["invoice_date"]),
        owner_id=uid(p["owner_id"]),
        version=p["version"],
        order_id=uid(link["po_number"]) if link["confirmed"] else None,
        link_method=link["method"] if link["confirmed"] else None,
        link_confirmed_by=uid(link["confirmed_by"]) if link["method"] == "human" else None,
        # fixtures only say "reviewed"; the owner is the operator who reviews signatures
        signature_reviewed_by=uid(p["owner_id"]) if p["signature_reviewed"] else None,
        processing=p["processing"],
        problem_since=created if status in _PROBLEM else None,  # fixtures/README.md
        created_at=created,
        updated_at=last_event_at(p["id"]),  # list default sort: -updated_at
    )


def _versions(p: Fixture) -> list[DocumentVersion]:
    # shortcut: fixtures lack package_version_at_upload; v1 files came with the package (1),
    # each later upload bumped the version once, in upload order. Exact history needs audit (B-12).
    flat = sorted(
        ((d["type"], v) for d in p["documents"] for v in d["versions"]),
        key=lambda tv: (tv[1]["uploaded_at"], tv[1]["version_no"]),
    )
    rows, bumps = [], 0
    for doc_type, v in flat:
        bumps += v["version_no"] > 1
        rows.append(
            DocumentVersion(
                id=version_id(p["id"], doc_type, v["version_no"]),
                company_id=COMPANY_ID,
                document_id=uid(f"{p['id']}:{doc_type}"),
                version_no=v["version_no"],
                file_name=v["file_name"],
                storage_key=f"demo/{p['id']}/{doc_type}/v{v['version_no']}/{v['file_name']}",
                sha256=v["sha256"],
                mime=MIME[PurePath(v["file_name"]).suffix.lower()],
                size=len(placeholder(v["file_name"])),  # the bytes the seed CLI stores
                pages=1,
                source_kind=v["source_kind"],
                status=v["status"],
                uploaded_by=uid(v["uploaded_by"]),
                package_version_at_upload=min(1 + bumps, p["version"]),
                created_at=ts(v["uploaded_at"]),
            )
        )
    return rows
