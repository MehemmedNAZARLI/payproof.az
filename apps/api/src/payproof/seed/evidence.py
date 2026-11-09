"""Evidence (page + quote) of each package's current invoice and delivery versions — the same
quotes the mock adapter writes for an upload, so seeded and uploaded documents look alike."""

from decimal import Decimal

from payproof.extraction.base import DeliveryData, Evidence, InvoiceData, LineData
from payproof.extraction.mock import delivery_evidence, invoice_evidence
from payproof.repositories.models import EvidenceRef
from payproof.seed.extraction import latest_version
from payproof.seed.fixtures import CUSTOMERS, PACKAGES, UNITS, Fixture, uid
from payproof.seed.identity import COMPANY_ID
from payproof.seed.packages import version_id


def _customer(slug: str | None) -> str:
    if slug is None:
        return "oxunmur"
    c = CUSTOMERS[slug]
    return f"{c['name']}, VÖEN {c['voen']}"


def _invoice(p: Fixture) -> list[Evidence]:
    inv = p["invoice"]
    data = InvoiceData(
        po_ref=inv["po_ref"],
        po_raw=inv["po_raw"],
        currency=p["currency"],
        total=Decimal(inv["total"]) if inv["total"] is not None else None,
        lines=tuple(
            LineData(li["product_code"], _qty(li["qty"]), UNITS[li["product_code"]],
                     Decimal(li["unit_price"]) if li["unit_price"] else None)
            for li in inv["lines"]
        ),
        unreadable=frozenset(f"invoice.{f}" for f in inv["unreadable_fields"]),
    )  # fmt: skip
    return invoice_evidence(data, _customer(p["customer_id"]))


def _qty(value: object) -> Decimal | None:
    return None if value is None else Decimal(str(value))


def _delivery(d: Fixture) -> list[Evidence]:
    data = DeliveryData(
        note_number=d["note_number"],
        po_ref=d["po_ref"],
        customer_id=None,
        signed=d["signed"],
        delivery_date=None,
        lines=tuple(LineData(li["product_code"], _qty(li["qty"]), None) for li in d["lines"]),
    )
    return delivery_evidence(data, _customer(d["customer_id"]))


def _rows(p: Fixture, doc_type: str, found: list[Evidence]) -> list[EvidenceRef]:
    no = latest_version(p, doc_type)
    if no is None:
        return []
    vid = version_id(p["id"], doc_type, no)
    return [
        EvidenceRef(
            id=uid(f"{p['id']}:evidence:{e.field_path}"),
            company_id=COMPANY_ID,
            document_version_id=vid,
            field_path=e.field_path,
            page=e.page,
            quote=e.quote,
        )
        for e in found
    ]


def evidence_rows() -> list[EvidenceRef]:
    rows: list[EvidenceRef] = []
    for p in PACKAGES.values():
        if p["processing"]:
            continue  # nothing extracted yet
        rows += _rows(p, "invoice", _invoice(p))
        if p["delivery"]:
            rows += _rows(p, "delivery", _delivery(p["delivery"]))
    return rows
