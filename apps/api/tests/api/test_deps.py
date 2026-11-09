"""current_member / require on test-only routes: 401, 403 and tenant isolation (404)."""

import uuid
from collections.abc import Callable
from typing import Annotated

import httpx
import pytest
from fastapi import Depends, FastAPI
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.api.deps import Member, Session, require
from payproof.core.errors import NotFound
from payproof.domain.permissions import Permission
from payproof.repositories.customers import CustomerRepository
from payproof.seed.fixtures import uid
from tests.integration.factories import make_tenant

Auth = Callable[[str], dict[str, str]]


@pytest.fixture(autouse=True)
def routes(app: FastAPI) -> None:
    async def read(
        cid: uuid.UUID, session: Session, _: Annotated[Member, Depends(require(Permission.VIEW))]
    ) -> dict[str, str]:
        customer = await CustomerRepository(session).get(cid)
        if customer is None:
            raise NotFound
        return {"name": customer.name}

    async def write(_: Annotated[Member, Depends(require(Permission.EDIT_PACKAGE))]) -> None:
        return None

    app.add_api_route("/v1/_test/customers/{cid}", read, methods=["GET"])
    app.add_api_route("/v1/_test/write", write, methods=["POST"])


@pytest.mark.parametrize(
    "headers",
    [{}, {"Authorization": "Bearer nope"}, {"Authorization": "Basic dTE6cHc="}],
    ids=["none", "garbage", "basic"],
)
async def test_without_valid_token_is_401(
    client: httpx.AsyncClient, seeded: AsyncSession, headers: dict[str, str]
) -> None:
    r = await client.get(f"/v1/_test/customers/{uid('c1')}", headers=headers)
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_assignee_token_is_401(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    # ADR-0008: assignees cannot sign in even with a valid signature
    r = await client.get(f"/v1/_test/customers/{uid('c1')}", headers=auth("u3"))
    assert r.status_code == 401


async def test_readonly_cannot_write(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    assert (await client.post("/v1/_test/write", headers=auth("u5"))).status_code == 403
    assert (await client.post("/v1/_test/write", headers=auth("u1"))).status_code == 200


async def test_other_tenant_object_is_404(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    other = await make_tenant(seeded)
    own = await client.get(f"/v1/_test/customers/{uid('c1')}", headers=auth("u1"))
    assert own.status_code == 200
    r = await client.get(f"/v1/_test/customers/{other.customer.id}", headers=auth("u1"))
    assert (r.status_code, r.json()["error"]["code"]) == (404, "NOT_FOUND")
