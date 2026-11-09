import datetime as dt
import uuid

import jwt
import pytest

from payproof.core.auth import TOKEN_TTL, DevTokenVerifier, issue_dev_token
from payproof.core.errors import Unauthenticated

SECRET = "test-only-not-a-secret-32-bytes-min"  # noqa: S105 — test key (HS256 wants >= 32 bytes)
USER = uuid.UUID("00000000-0000-0000-0000-0000000000a1")


def test_round_trip() -> None:
    token, expires_in = issue_dev_token(USER, SECRET)
    assert expires_in == int(TOKEN_TTL.total_seconds()) == 28_800
    assert DevTokenVerifier(SECRET).verify(token) == USER


@pytest.mark.parametrize(
    "token",
    [
        "",
        "not.a.jwt",
        issue_dev_token(USER, "another-test-only-secret-32-bytes")[0],
        jwt.encode({"sub": str(USER)}, SECRET, algorithm="HS256"),  # no exp / aud / iss
        jwt.encode(
            {"sub": "nope", "exp": 4102444800, "aud": "payproof-api", "iss": "payproof-dev"},
            SECRET,
            algorithm="HS256",
        ),
    ],
    ids=["empty", "garbage", "wrong-key", "missing-claims", "bad-sub"],
)
def test_rejects_invalid_tokens(token: str) -> None:
    with pytest.raises(Unauthenticated):
        DevTokenVerifier(SECRET).verify(token)


def test_rejects_expired_token() -> None:
    token, _ = issue_dev_token(USER, SECRET, now=dt.datetime.now(dt.UTC) - TOKEN_TTL * 2)
    with pytest.raises(Unauthenticated):
        DevTokenVerifier(SECRET).verify(token)


def test_rejects_alg_none() -> None:
    token = jwt.encode({"sub": str(USER)}, key=None, algorithm="none")
    with pytest.raises(Unauthenticated):
        DevTokenVerifier(SECRET).verify(token)
