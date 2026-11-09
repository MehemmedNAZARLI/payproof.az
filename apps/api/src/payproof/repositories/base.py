import uuid
from typing import Any, cast

from sqlalchemy import Select, Table, event, inspect, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import ORMExecuteState, Session, with_loader_criteria
from sqlalchemy.sql.visitors import ExternallyTraversible, iterate

from payproof.repositories.orm import TENANT_COLUMN, TenantEntity, TenantMixin

TENANT_KEY = "payproof.company_id"


class TenantContextMissing(RuntimeError):
    """Programming error: tenant data was queried before `bind_tenant` (surfaces as 500)."""


class TenantViolation(RuntimeError):
    """Programming error: a write or rebind would cross tenants (surfaces as 500)."""


def bind_tenant(session: AsyncSession | Session, company_id: uuid.UUID) -> None:
    """Called once per request from the current membership (B-10), never from request input."""
    bound = session.info.get(TENANT_KEY)
    if bound is not None and bound != company_id:
        # identity map may hold the old tenant's rows
        raise TenantViolation("session is already bound to another tenant")
    session.info[TENANT_KEY] = company_id


def _is_tenant_table(element: Any) -> bool:
    return isinstance(element, Table) and any(c.info.get(TENANT_COLUMN) for c in element.c)


@event.listens_for(Session, "do_orm_execute")
def _scope_to_tenant(state: ORMExecuteState) -> None:
    # shortcut: raw SQL (`text()`) is not covered — keep it out of repositories
    if state.is_column_load or state.is_relationship_load:
        return  # the parent query already carries the criteria
    company_id = state.session.info.get(TENANT_KEY)
    statement = cast(ExternallyTraversible, state.statement)
    touches_tenant = any(_is_tenant_table(el) for el in iterate(statement))
    if state.is_insert:
        if touches_tenant and company_id is not None:
            raise TenantViolation("bulk insert into a tenant table; use BaseRepository.add")
        return
    if company_id is None:
        if touches_tenant:
            raise TenantContextMissing("tenant table queried without bind_tenant()")
        return
    state.statement = state.statement.options(
        with_loader_criteria(
            TenantMixin, lambda cls: cls.company_id == company_id, include_aliases=True
        )
    )


@event.listens_for(Session, "before_flush")
def _check_tenant_writes(session: Session, *_: object) -> None:
    company_id = session.info.get(TENANT_KEY)
    for obj in session.new:
        if not isinstance(obj, TenantMixin) or company_id is None:
            continue  # unbound sessions (seed, system jobs) set company_id explicitly
        if obj.company_id is None:
            obj.company_id = company_id
        elif obj.company_id != company_id:
            raise TenantViolation("new row belongs to another tenant")
    for obj in session.dirty:
        if isinstance(obj, TenantMixin) and inspect(obj).attrs.company_id.history.deleted:
            raise TenantViolation("company_id of an existing row cannot change")


class BaseRepository[M: TenantEntity]:
    model: type[M]  # set by the subclass: `model = Customer`

    def __init__(self, session: AsyncSession) -> None:
        if TENANT_KEY not in session.info:
            raise TenantContextMissing("repository created without bind_tenant()")
        self.session = session
        self.company_id: uuid.UUID = session.info[TENANT_KEY]

    def _select(self) -> Select[M]:
        return select(self.model)

    async def get(self, id_: uuid.UUID) -> M | None:
        """Other tenants' rows are invisible, so callers map `None` to NotFound (404)."""
        result = await self.session.execute(self._select().where(self.model.id == id_))
        return result.scalar_one_or_none()

    def add(self, obj: M) -> M:
        obj.company_id = self.company_id
        self.session.add(obj)
        return obj
