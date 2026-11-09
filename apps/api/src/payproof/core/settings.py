from functools import lru_cache
from pathlib import Path
from typing import Literal, Self

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_API_DIR = Path(__file__).resolve().parents[3]
_MIN_SECRET = 32  # HS256 key length (RFC 7518 §3.2)
_PUBLIC_SECRETS = {"dev-only-change-me", "ci-only-not-a-secret"}  # committed in the repo


class Settings(BaseSettings):
    # .env lives at the repo root (scripts/setup.sh); apps/api/.env overrides it. CWD-independent.
    model_config = SettingsConfigDict(
        env_file=(_API_DIR.parents[1] / ".env", _API_DIR / ".env"), extra="ignore"
    )

    env: Literal["dev", "test", "prod"]  # no default: a forgotten ENV must not mean "dev"
    log_level: str = "INFO"
    database_url: str
    jwt_secret: SecretStr
    s3_endpoint_url: str
    s3_access_key: str
    s3_secret_key: SecretStr
    s3_bucket: str
    # ADR-0011 §5: switching provider is env-only. `pdf` (text layer) stays for the transition.
    ai_provider: Literal["mock", "pdf", "anthropic", "openai"] = "mock"
    ai_api_key: SecretStr | None = None  # server-side only; never logged or returned
    ai_model: str | None = None  # empty: the provider adapter's default model
    ai_base_url: str | None = None  # empty: the provider's own endpoint
    ai_timeout_seconds: float = Field(default=120.0, gt=0, le=600)
    ai_max_retries: int = Field(default=2, ge=0, le=5)
    # below this the extracted value counts as unread (a person reads it) — never a guess
    ai_min_confidence: float = Field(default=0.8, gt=0, le=1)
    # ADR-0011 §4 e-mail submission of exports (Resend); without a key dev/test only log
    resend_api_key: SecretStr | None = None
    resend_from: str = "PayProof <hesabat@payproof.az>"
    resend_base_url: str = "https://api.resend.com"
    # signed links must use an address the browser reaches; in compose the API itself talks to
    # http://minio:9000, the browser to http://localhost:9000. Unset: same as s3_endpoint_url
    s3_public_endpoint_url: str | None = None
    api_host: str = "127.0.0.1"  # 0.0.0.0 inside a container
    api_reload: bool = True  # only in dev; off in the container image
    # comma-separated browser origins allowed to call the API (web :3000, mobile :3001)
    cors_origins: str = "http://localhost:3000,http://localhost:3001"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @model_validator(mode="after")
    def _ai_provider_is_configured(self) -> Self:
        if self.ai_provider in ("anthropic", "openai"):
            key = self.ai_api_key.get_secret_value().strip() if self.ai_api_key else ""
            if not key:
                raise ValueError(f"AI_PROVIDER={self.ai_provider} requires AI_API_KEY")
        if self.ai_base_url and not self.ai_base_url.startswith(("https://", "http://")):
            raise ValueError("AI_BASE_URL must be an http(s) URL")
        return self

    @model_validator(mode="after")
    def _prod_secret_is_strong(self) -> Self:
        secret = self.jwt_secret.get_secret_value()
        if self.env == "prod" and (len(secret) < _MIN_SECRET or secret in _PUBLIC_SECRETS):
            raise ValueError(f"JWT_SECRET must be a private value of >= {_MIN_SECRET} bytes")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
