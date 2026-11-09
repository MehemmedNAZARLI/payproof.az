"""Customers and their requirement set versions (approver changes them)."""

import datetime as dt
import uuid
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.api.deps import Member, Session, require
from payproof.core.errors import NotFound
from payproof.domain.permissions import Permission
from payproof.repositories import package_reads as reads
from payproof.repositories.models import Customer, RequirementSet
from payproof.schemas import config as cfg
from payproof.schemas import detail as d
from payproof.schemas.auth import UserRef
from payproof.services import requirement_config, requirements

router = APIRouter(tags=["customers"])
Viewer = Annotated[Member, Depends(require(Permission.VIEW))]
RuleKeeper = Annotated[Member, Depends(require(Permission.MANAGE_REQUIREMENTS))]


class CustomerOut(BaseModel):
    id: uuid.UUID
    name: str
    external_id: str
    voen: str
    current_requirements: d.RequirementSet | None


class Items[T](BaseModel):
    items: list[T]


class CreateRules(BaseModel):
    model_config = ConfigDict(extra="forbid")

    require_po: bool
    require_delivery: bool
    require_signature: bool
    tolerance: Decimal = Field(ge=0, le=1, decimal_places=2)
    effective_from: dt.date
    reason: str = Field(min_length=10, max_length=500)
    expected_version: int = Field(ge=1)
    documents: list[cfg.DocumentRequirementIn] | None = Field(default=None, min_length=1)
    checks: list[cfg.CheckConfig] | None = None
    output: cfg.OutputConfig | None = None


async def _out(session: AsyncSession, sets: list[RequirementSet]) -> list[d.RequirementSet]:
    users = await reads.owners(session, {s.approved_by for s in sets})

    def ref(user_id: uuid.UUID) -> UserRef:
        user, role = users[user_id]
        return UserRef(id=user.id, full_name=user.full_name, title=user.title, role=role)

    names = await requirement_config.type_names(session)
    return [requirement_config.requirement_set_out(s, ref(s.approved_by), names) for s in sets]


@router.get("/customers")
async def list_customers(session: Session, _: Viewer) -> Items[CustomerOut]:
    customers = (await session.scalars(select(Customer).order_by(Customer.name))).all()
    current = [rs for c in customers if (rs := await requirements.latest(session, c.id))]
    by_customer = {
        s.customer_id: o for s, o in zip(current, await _out(session, current), strict=True)
    }
    return Items(
        items=[
            CustomerOut(
                id=c.id,
                name=c.name,
                external_id=c.external_id,
                voen=c.voen,
                current_requirements=by_customer.get(c.id),
            )
            for c in customers
        ]
    )


@router.get("/customers/{customer_id}/requirements")
async def list_rule_sets(
    customer_id: uuid.UUID, session: Session, _: Viewer
) -> Items[d.RequirementSet]:
    if await session.scalar(select(Customer.id).where(Customer.id == customer_id)) is None:
        raise NotFound
    sets = await session.scalars(
        select(RequirementSet)
        .where(RequirementSet.customer_id == customer_id)
        .order_by(RequirementSet.version.desc())
    )
    return Items(items=await _out(session, list(sets.all())))


@router.post("/customers/{customer_id}/requirements", status_code=201)
async def create_rule_set(
    customer_id: uuid.UUID, body: CreateRules, session: Session, member: RuleKeeper
) -> d.RequirementSet:
    rs = await requirements.create_rule_set(
        session,
        actor_id=member.user_id,
        customer_id=customer_id,
        new=requirements.NewRules(
            **body.model_dump(exclude={"output"}),
            output=body.output.model_dump(exclude_none=True) if body.output else None,
        ),
    )
    [out] = await _out(session, [rs])
    return out
