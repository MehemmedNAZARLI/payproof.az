from collections.abc import Callable

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.settings import get_settings
from payproof.main import create_app
from payproof.seed.fixtures import uid

Auth = Callable[[str], dict[str, str]]
OPERATOR = ["VIEW", "EDIT_PACKAGE", "MANAGE_TASKS", "EXPORT_PACKAGE", "DELETE_PACKAGE"]


async def test_dev_users_offer_only_sign_in_roles(
    client: httpx.AsyncClient, seeded: AsyncSession
) -> None:
    r = await client.get("/v1/auth/dev-users")
    assert r.status_code == 200
    users = r.json()["items"]
    assert {u["role"] for u in users} == {"operator", "approver", "readonly"}  # ADR-0008
    assert uid("u3") not in {u["id"] for u in users}
    assert set(users[0]) == {"id", "full_name", "title", "role"}


async def test_dev_login_issues_a_working_token(
    client: httpx.AsyncClient, seeded: AsyncSession
) -> None:
    r = await client.post("/v1/auth/dev-login", json={"user_id": str(uid("u1"))})
    assert r.status_code == 200
    body = r.json()
    assert (body["token_type"], body["expires_in"]) == ("bearer", 28_800)
    assert body["user"]["permissions"] == OPERATOR
    me = await client.get("/v1/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.json() == body["user"]
    assert me.json()["company"] == {
        "id": str(uid("company_a")),
        "name": "A Distribusiya MMC",
        "voen": "1700123451",
    }


@pytest.mark.parametrize("user", ["u3", "nobody"], ids=["assignee", "unknown"])
async def test_assignee_or_unknown_user_cannot_log_in(
    client: httpx.AsyncClient, seeded: AsyncSession, user: str
) -> None:
    r = await client.post("/v1/auth/dev-login", json={"user_id": str(uid(user))})
    assert r.status_code == 422
    assert r.json()["error"]["details"] == {"fields": {"user_id": "Naməlum istifadəçi."}}


async def test_malformed_login_body_is_400(client: httpx.AsyncClient) -> None:
    r = await client.post("/v1/auth/dev-login", json={"user": "x"})
    assert (r.status_code, r.json()["error"]["code"]) == (400, "VALIDATION_ERROR")


@pytest.mark.parametrize("env", ["prod", "test"])
async def test_no_dev_login_outside_dev(env: str) -> None:
    app = create_app(get_settings().model_copy(update={"env": env}))
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        assert (await c.get("/v1/auth/dev-users")).status_code == 404
        assert (
            await c.post("/v1/auth/dev-login", json={"user_id": str(uid("u1"))})
        ).status_code == 404


async def test_prod_never_accepts_dev_tokens(seeded: AsyncSession, auth: Auth) -> None:
    # until a JWKS verifier exists (ADR-0003), prod refuses every token instead of trusting HS256
    prod = get_settings().model_copy(update={"env": "prod"})
    app = create_app(prod)
    app.dependency_overrides[get_settings] = lambda: prod
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.get("/v1/me", headers=auth("u2"))
    assert r.status_code == 500 and r.json()["error"]["code"] == "INTERNAL_ERROR"


async def test_me_needs_a_token(client: httpx.AsyncClient) -> None:
    assert (await client.get("/v1/me")).status_code == 401


async def test_me_of_readonly_user(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    me = (await client.get("/v1/me", headers=auth("u5"))).json()
    assert (me["role"], me["permissions"]) == ("readonly", ["VIEW"])


async def test_users_and_assignable_users(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    everyone = (await client.get("/v1/users", headers=auth("u1"))).json()["items"]
    assert len(everyone) == 7
    assignable = (await client.get("/v1/users?assignable=true", headers=auth("u1"))).json()
    roles = {u["role"] for u in assignable["items"]}
    assert "readonly" not in roles and "assignee" in roles  # warehouse etc. take tasks
