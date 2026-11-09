import pytest
from pydantic import ValidationError

from payproof.core.settings import Settings


@pytest.fixture(autouse=True)
def _database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    # these tests skip .env, so give them a URL and storage; nothing connects to them
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@localhost:1/db")
    for name, value in {
        "S3_ENDPOINT_URL": "http://localhost:1",
        "S3_ACCESS_KEY": "k",
        "S3_SECRET_KEY": "s",
        "S3_BUCKET": "payproof-docs",
    }.items():
        monkeypatch.setenv(name, value)


def test_loads_ci_environment() -> None:
    s = Settings(_env_file=None)
    assert s.env == "test"
    assert s.database_url.startswith("postgresql+asyncpg://")
    assert s.ai_provider == "mock"
    assert s.s3_bucket == "payproof-docs"


def test_secret_is_not_printed() -> None:
    s = Settings(_env_file=None)
    assert "test-only" not in repr(s)


def test_missing_jwt_secret_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("JWT_SECRET")
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_unknown_env_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENV", "staging-ish")
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_env_is_required_never_defaults_to_dev(monkeypatch: pytest.MonkeyPatch) -> None:
    # a forgotten ENV must not mount dev login (fail closed)
    monkeypatch.delenv("ENV")
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


@pytest.mark.parametrize("secret", ["short", "dev-only-change-me"])
def test_prod_rejects_weak_or_sample_jwt_secret(
    monkeypatch: pytest.MonkeyPatch, secret: str
) -> None:
    monkeypatch.setenv("ENV", "prod")
    monkeypatch.setenv("JWT_SECRET", secret)
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        Settings(_env_file=None)


def test_prod_accepts_a_strong_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENV", "prod")
    monkeypatch.setenv("JWT_SECRET", "x" * 32)
    assert Settings(_env_file=None).env == "prod"


def test_env_files_resolve_independent_of_cwd() -> None:
    files = Settings.model_config["env_file"]
    assert isinstance(files, tuple)
    assert [p.name for p in files] == [".env", ".env"]
    assert (files[0].parent / "apps/api/pyproject.toml").exists()
