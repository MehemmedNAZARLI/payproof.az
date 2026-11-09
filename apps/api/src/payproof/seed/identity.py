"""Company, users, memberships, customers and rule sets from fixtures (deterministic ids)."""

import datetime as dt
import uuid
from collections.abc import Sequence
from decimal import Decimal

from payproof.repositories.models import Company, Customer, Membership, RequirementSet, User
from payproof.repositories.orm import Base
from payproof.seed.fixtures import CUSTOMERS, Fixture, load, uid

COMPANY_ID = uid("company_a")


def identity_rows() -> list[Sequence[Base]]:
    """Rows in insert order: each inner list only references rows of earlier lists."""
    company = load("company.json")
    users = load("users.json")
    return [
        [Company(id=COMPANY_ID, name=company["name"], voen=company["voen"])],
        [User(id=uid(u["id"]), email=u["email"], full_name=u["full_name"], title=u["title"])
         for u in users],
        [Membership(id=uid(f"member:{u['id']}"), user_id=uid(u["id"]), company_id=COMPANY_ID,
                    role=u["role"]) for u in users],
        [Customer(id=uid(c["id"]), company_id=COMPANY_ID, name=c["name"],
                  external_id=c["external_id"], voen=c["voen"]) for c in CUSTOMERS.values()],
        [_rule_set(c["id"], rs) for c in CUSTOMERS.values() for rs in c["requirement_sets"]],
    ]  # fmt: skip


def rule_set_id(customer: str, version: int) -> uuid.UUID:
    return uid(f"{customer}:rules:v{version}")


def _rule_set(customer: str, rs: Fixture) -> RequirementSet:
    return RequirementSet(
        id=rule_set_id(customer, rs["version"]),
        company_id=COMPANY_ID,
        customer_id=uid(customer),
        version=rs["version"],
        require_po=rs["require_po"],
        require_delivery=rs["require_delivery"],
        require_signature=rs["require_signature"],
        tolerance=Decimal(rs["tolerance"]),
        effective_from=dt.date.fromisoformat(rs["effective_from"]),
        approved_by=uid(rs["approved_by"]),
        reason=rs["reason"],
    )
