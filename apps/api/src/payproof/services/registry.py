"""Document type registry (ADR-0011 §1): `fixtures/config/document-types.json` → `document_types`.

Every (key, version) is stored once and never changed; editing an entry's schema without a new
version is refused, so stored extractions always know the schema they were read with."""

import json
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.models import DocumentTypeEntry

CONFIG = Path(__file__).parents[5] / "fixtures" / "config"  # repo root (image: /app/fixtures)
_COLUMNS = ("name", "builtin", "accepted_formats", "extraction", "instructions")


class RegistryMismatch(RuntimeError):
    """A stored registry version differs from the configuration file."""


def load_entries() -> list[dict[str, Any]]:
    data: list[dict[str, Any]] = json.loads((CONFIG / "document-types.json").read_text())
    return data


def load_library() -> dict[str, Any]:
    data: dict[str, Any] = json.loads((CONFIG / "check-library.json").read_text())
    return data


async def sync(session: AsyncSession, entries: list[dict[str, Any]] | None = None) -> None:
    entries = load_entries() if entries is None else entries
    stored = {(r.key, r.version): r for r in (await session.scalars(select(DocumentTypeEntry)))}
    for e in entries:
        row = stored.get((e["key"], e["version"]))
        if row is None:
            session.add(DocumentTypeEntry(key=e["key"], version=e["version"],
                                          **{c: e[c] for c in _COLUMNS}))  # fmt: skip
        elif any(getattr(row, c) != e[c] for c in _COLUMNS):
            raise RegistryMismatch(
                f"{e['key']} v{e['version']} changed; a schema change needs a new version"
            )
    await session.flush()


async def current(session: AsyncSession) -> dict[str, DocumentTypeEntry]:
    """The newest version of every registry key."""
    rows = await session.scalars(select(DocumentTypeEntry).order_by(DocumentTypeEntry.version))
    return {r.key: r for r in rows}
