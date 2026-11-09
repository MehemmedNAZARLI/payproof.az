"""Snapshot builders for rule tests: a clean INV-1042-like package that every rule passes."""

import dataclasses
import uuid
from decimal import Decimal
from typing import Any

from payproof.domain.enums import Currency
from payproof.domain.money import Money
from payproof.domain.snapshot import (
    Delivery,
    DeliveryLine,
    EvidenceRef,
    Invoice,
    InvoiceLine,
    Order,
    OrderLine,
    PackageSnapshot,
    Party,
    Rules,
)

AZN = Currency.AZN
BUYER = uuid.UUID("00000000-0000-0000-0000-0000000000c1")
OTHER = uuid.UUID("00000000-0000-0000-0000-0000000000c2")
PARTIES = {
    BUYER: Party("B Mağazalar Şəbəkəsi", "1402375611"),
    OTHER: Party("C Restoran Qrupu", "1305884421"),
}
EVIDENCE_PATHS = (
    "invoice.po_ref",
    "invoice.customer",
    "invoice.total",
    "order.po_number",
    "order.customer",
    "order.total",
    "delivery.customer",
    "delivery.po_ref",
    "delivery.signed",
)


def azn(v: str) -> Money:
    return Money(v, AZN)


def evidence(path: str) -> EvidenceRef:
    return EvidenceRef(uuid.uuid5(uuid.NAMESPACE_URL, path), 1, f"quote for {path}", None)


def invoice(**over: Any) -> Invoice:
    base = Invoice(
        po_ref="PO-381",
        po_raw=None,
        unreadable_fields=frozenset(),
        lines=(
            InvoiceLine("GY-1L", Decimal("800"), "ədəd", azn("9.00")),
            InvoiceLine("DY-5", Decimal("400"), "ədəd", azn("12.00")),
        ),
        total=azn("12000.00"),
    )
    return dataclasses.replace(base, **over)


def order(**over: Any) -> Order:
    base = Order(
        po="PO-381",
        customer_id=BUYER,
        currency=AZN,
        lines=(
            OrderLine("GY-1L", Decimal("800"), "ədəd", azn("9.00")),
            OrderLine("DY-5", Decimal("400"), "ədəd", azn("12.00")),
        ),
    )
    return dataclasses.replace(base, **over)


def delivery(**over: Any) -> Delivery:
    base = Delivery("TS-5531", "PO-381", BUYER, (DeliveryLine("GY-1L", Decimal("800")),), True)
    return dataclasses.replace(base, **over)


def rules(**over: Any) -> Rules:
    return dataclasses.replace(Rules(True, True, False, Decimal("0.01")), **over)


def snapshot(**over: Any) -> PackageSnapshot:
    fields: dict[str, Any] = {
        "currency": AZN,
        "customer_id": BUYER,
        "invoice": invoice(),
        "order": order(),
        "candidates": (),
        "delivery": delivery(),
        "signature_reviewed": False,
        "rules": rules(),
        "parties": PARTIES,
        "evidence": {p: evidence(p) for p in EVIDENCE_PATHS},
    }
    fields.update(over)
    return PackageSnapshot(**fields)
