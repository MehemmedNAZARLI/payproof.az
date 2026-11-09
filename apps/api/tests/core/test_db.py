from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.db import get_engine, get_session
from payproof.core.settings import get_settings


def test_engine_uses_settings_url() -> None:
    url = get_engine().url
    assert url.drivername == "postgresql+asyncpg"
    assert url.render_as_string(hide_password=False) == get_settings().database_url


async def test_session_dependency_yields_async_session() -> None:
    gen = get_session()
    session = await anext(gen)
    assert isinstance(session, AsyncSession)
    assert session.bind is get_engine()
    await gen.aclose()
