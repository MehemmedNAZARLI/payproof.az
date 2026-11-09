"""Extraction results of each package's current invoice and delivery versions."""

import datetime as dt
import uuid
from collections.abc import Sequence
from decimal import Decimal

from payproof.domain.rules.paths import line
from payproof.repositories.models import (
    DeliveryNote,
    DeliveryNoteLine,
    ExtractedField,
    ExtractedInvoice,
    ExtractedInvoiceLine,
)
from payproof.repositories.orm import Base
from payproof.seed.fixtures import PACKAGES, UNITS, Fixture, uid
from payproof.seed.identity import COMPANY_ID
from payproof.seed.packages import version_id


def latest_version(p: Fixture, doc_type: str) -> int | None:
    doc = next((d for d in p["documents"] if d["type"] == doc_type), None)
    return max(v["version_no"] for v in doc["versions"]) if doc else None


def _invoice(p: Fixture, no: int) -> list[Base]:
    pid, inv = p["id"], p["invoice"]
    vid, eid = version_id(pid, "invoice", no), uid(f"{pid}:extracted_invoice")
    head = ExtractedInvoice(
        id=eid,
        company_id=COMPANY_ID,
        document_version_id=vid,
        po_ref=inv["po_ref"],
        po_raw=inv["po_raw"],
        total=Decimal(inv["total"]),
        currency=p["currency"],
    )
    lines = [
        ExtractedInvoiceLine(
            id=uid(f"{pid}:invoice_line:{li['product_code']}"),
            company_id=COMPANY_ID,
            extracted_invoice_id=eid,
            product_code=li["product_code"],
            qty=Decimal(str(li["qty"])),
            unit=UNITS[li["product_code"]],
            unit_price=Decimal(li["unit_price"]),
        )
        for li in inv["lines"]
    ]
    return [head, *lines, *_fields(p, vid)]


def _fields(p: Fixture, vid: uuid.UUID) -> list[ExtractedField]:
    """Editable fields (mock `fieldPaths`): PO, then qty and unit price per line. An unread
    critical field waits for a person (INV-1047: PO not read on the scan)."""
    inv, pid = p["invoice"], p["id"]
    unread = "po_ref" in inv["unreadable_fields"]
    values: list[tuple[str, str | None, str | None, bool]] = [
        ("invoice.po_ref", inv["po_raw"] if unread else inv["po_ref"], inv["po_ref"], unread)
    ]
    for li in inv["lines"]:
        code, qty = li["product_code"], str(li["qty"])
        values += [
            (line("invoice", code, "qty"), qty, qty, False),
            (line("invoice", code, "unit_price"), li["unit_price"], li["unit_price"], False),
        ]
    return [
        ExtractedField(
            id=field_id(pid, path),
            company_id=COMPANY_ID,
            document_version_id=vid,
            field_path=path,
            raw_value=raw,
            normalized_value=value,
            review_status="REVIEW_REQUIRED" if review else "EXTRACTED",
        )
        for path, raw, value, review in values
    ]


def field_id(pid: str, path: str) -> uuid.UUID:
    return uid(f"{pid}:field:{path}")


def _delivery(p: Fixture, d: Fixture, no: int) -> list[Base]:
    pid, nid = p["id"], uid(f"{p['id']}:delivery_note")
    note = DeliveryNote(
        id=nid,
        company_id=COMPANY_ID,
        document_version_id=version_id(pid, "delivery", no),
        note_number=d["note_number"],
        po_ref=d["po_ref"],
        customer_id=uid(d["customer_id"]) if d["customer_id"] else None,
        signed=d["signed"],
        delivery_date=dt.date.fromisoformat(d["delivery_date"]) if d["delivery_date"] else None,
    )
    lines = [
        DeliveryNoteLine(
            id=uid(f"{pid}:delivery_line:{li['product_code']}"),
            company_id=COMPANY_ID,
            delivery_note_id=nid,
            product_code=li["product_code"],
            qty=Decimal(str(li["qty"])),
        )
        for li in d["lines"]
    ]
    return [note, *lines]


def extraction_rows() -> list[Sequence[Base]]:
    """Heads before lines, so one flush per group satisfies the FKs."""
    heads: list[Base] = []
    for p in PACKAGES.values():
        if p["processing"]:
            continue  # extraction not finished yet
        if (no := latest_version(p, "invoice")) is not None:
            heads += _invoice(p, no)
        if p["delivery"] and (no := latest_version(p, "delivery")) is not None:
            heads += _delivery(p, p["delivery"], no)
    first = [r for r in heads if isinstance(r, ExtractedInvoice | DeliveryNote)]
    return [first, [r for r in heads if r not in first]]
