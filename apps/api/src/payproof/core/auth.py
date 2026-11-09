"""Token verification (ADR-0003). The token only says who the user is (`sub`); company and role
come from `memberships`. Swapping to a managed provider means a JWKS verifier here, nothing else."""

import datetime as dt
import uuid
from typing import Protocol

import jwt

from payproof.core.errors import Unauthenticated

TOKEN_TTL = dt.timedelta(hours=8)
_ALGORITHM = "HS256"
_AUDIENCE = "payproof-api"
_ISSUER = "payproof-dev"


class TokenVerifier(Protocol):
    def verify(self, token: str) -> uuid.UUID:
        """User id of a valid token; raises Unauthenticated otherwise."""
        ...


class DevTokenVerifier:
    """Local HS256 key for dev/demo login (ENV=dev)."""

    def __init__(self, secret: str) -> None:
        self._secret = secret

    def verify(self, token: str) -> uuid.UUID:
        try:
            claims = jwt.decode(
                token,
                self._secret,
                algorithms=[_ALGORITHM],  # pinned: never "none" or a key-confusion alg
                audience=_AUDIENCE,
                issuer=_ISSUER,
                options={"require": ["sub", "exp", "iat", "aud", "iss"]},
            )
            return uuid.UUID(claims["sub"])
        except (jwt.PyJWTError, ValueError):
            raise Unauthenticated from None


def token_expiry(token: str) -> dt.datetime:
    """`exp` of a token a verifier has already accepted (only then: the signature is not
    checked here). Open streams close at this time."""
    exp = jwt.decode(token, options={"verify_signature": False})["exp"]
    return dt.datetime.fromtimestamp(exp, dt.UTC)


def issue_dev_token(
    user_id: uuid.UUID, secret: str, now: dt.datetime | None = None
) -> tuple[str, int]:
    """(token, expires_in seconds) for POST /v1/auth/dev-login."""
    issued = now or dt.datetime.now(dt.UTC)
    claims = {
        "sub": str(user_id),
        "iat": issued,
        "exp": issued + TOKEN_TTL,
        "aud": _AUDIENCE,
        "iss": _ISSUER,
    }
    return jwt.encode(claims, secret, algorithm=_ALGORITHM), int(TOKEN_TTL.total_seconds())
