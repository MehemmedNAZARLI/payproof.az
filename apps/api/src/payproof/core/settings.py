from functools import lru_cache
from pathlib import Path
from typing import Literal, Self

from pydantic import SecretStr, model_validator
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
    ai_provider: Literal["mock", "pdf", "llm"] = "mock"
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
    def _prod_secret_is_strong(self) -> Self:
        secret = self.jwt_secret.get_secret_value()
        if self.env == "prod" and (len(secret) < _MIN_SECRET or secret in _PUBLIC_SECRETS):
            raise ValueError(f"JWT_SECRET must be a private value of >= {_MIN_SECRET} bytes")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
