"""fixtures/*.json -> PackageSnapshot, mirroring the mock engine's evaluate()/info() inputs."""

import json
import uuid
from decimal import Decimal
from pathlib import Path
from typing import Any

from payproof.domain.enums import Currency, PackageStatus
from payproof.domain.money import Money
from payproof.domain.rules.engine import evaluate, primary_blockers
from payproof.domain.rules.result import CheckResult
from payproof.domain.snapshot import (
    Delivery,
    DeliveryLine,
    Invoice,
    InvoiceLine,
    Order,
    OrderLine,
    PackageSnapshot,
    Party,
    Rules,
)
from payproof.domain.status import derive_status

FIXTURES = Path(__file__).parents[5] / "fixtures"  # repo root; dev/test data only
Fixture = dict[str, Any]


def load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text())


# fixture lines carry no unit; the prototype takes it from the product catalogue
UNITS = {p["code"]: p["unit"] for p in load("products.json")}
ORDERS = {o["po_number"]: o for o in load("orders.json")}
CUSTOMERS = {c["id"]: c for c in load("customers.json")}
PACKAGES = {p["invoice_number"]: p for p in load("packages.json")}
EXPECTED = load("expected.json")


def uid(slug: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_URL, f"payproof:{slug}")


def rule_set(pkg: Fixture) -> Fixture:
    """Rule set of the current version's export, else the customer's latest (rules-engine.md)."""
    sets = CUSTOMERS[pkg["customer_id"]]["requirement_sets"]
    export = next((e for e in pkg["exports"] if e["package_version"] == pkg["version"]), None)
    if export:
        return next(r for r in sets if r["version"] == export["requirement_set_version"])
    return max(sets, key=lambda r: r["version"])


def _money(value: str | None, currency: Currency) -> Money | None:
    return None if value is None else Money(value, currency)


def _qty(value: int | str | None) -> Decimal | None:
    return None if value is None else Decimal(str(value))


def snapshot_of(pkg: Fixture) -> PackageSnapshot:
    cur, inv, link = Currency(pkg["currency"]), pkg["invoice"], pkg["order_link"]
    invoice = Invoice(
        po_ref=inv["po_ref"],
        po_raw=inv["po_raw"],
        unreadable_fields=frozenset(f"invoice.{f}" for f in inv["unreadable_fields"]),
        lines=tuple(
            InvoiceLine(li["product_code"], _qty(li["qty"]), UNITS[li["product_code"]],
                        _money(li["unit_price"], cur))
            for li in inv["lines"]
        ),
        total=_money(inv["total"], cur),
    )  # fmt: skip
    order = None
    if link["confirmed"]:
        o = ORDERS[link["po_number"]]
        ocur = Currency(o["currency"])
        order = Order(
            po=o["po_number"],
            customer_id=uid(o["customer_id"]),
            currency=ocur,
            lines=tuple(
                OrderLine(ol["product_code"], Decimal(str(ol["qty"])), UNITS[ol["product_code"]],
                          Money(ol["unit_price"], ocur))
                for ol in o["lines"]
            ),
        )  # fmt: skip
    d = pkg["delivery"]
    delivery = d and Delivery(
        no=d["note_number"],
        po_ref=d["po_ref"],
        customer_id=uid(d["customer_id"]) if d["customer_id"] else None,
        lines=tuple(DeliveryLine(dl["product_code"], _qty(dl["qty"])) for dl in d["lines"]),
        signed=d["signed"],
    )
    rs = rule_set(pkg)
    return PackageSnapshot(
        currency=cur,
        customer_id=uid(pkg["customer_id"]),
        invoice=invoice,
        order=order,
        candidates=() if order else tuple(c["po_number"] for c in pkg["candidates"]),
        delivery=delivery,
        signature_reviewed=pkg["signature_reviewed"],
        rules=Rules(rs["require_po"], rs["require_delivery"], rs["require_signature"],
                    Decimal(rs["tolerance"])),
        parties={uid(c["id"]): Party(c["name"], c["voen"]) for c in CUSTOMERS.values()},
    )  # fmt: skip


def outcome_of(pkg: Fixture) -> tuple[PackageStatus, tuple[CheckResult, ...]]:
    """(status, checks) as the API will derive them; checks are empty while processing."""
    version, rs_version = pkg["version"], rule_set(pkg)["version"]
    approved = any(
        a["valid"]
        and a["package_version"] == version
        and a["requirement_set_version"] == rs_version
        for a in pkg["approvals"]
    )
    exported = any(e["package_version"] == version for e in pkg["exports"])
    checks = () if pkg["processing"] else evaluate(snapshot_of(pkg))
    status = derive_status(
        processing=pkg["processing"],
        link_confirmed=pkg["order_link"]["confirmed"],
        checks=checks,
        approved=approved,
        exported=exported,
    )
    return status, checks


def blocker_list(checks: tuple[CheckResult, ...]) -> list[dict[str, str]]:
    """expected.json `blockers` = primary (non-cascade) blockers (fixtures/README.md)."""
    return [{"rule_id": c.rule_id, "outcome": c.outcome.value} for c in primary_blockers(checks)]
