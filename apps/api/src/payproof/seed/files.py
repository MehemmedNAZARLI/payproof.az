"""Placeholder bytes for the demo documents: valid by content (they pass `files.inspect`), so a
signed download opens something; their real size goes into `document_versions.size`.
The fixture sha256 stays synthetic (hash of the file name, fixtures/README.md)."""

import io
import json
import zipfile
from collections.abc import Sequence
from functools import cache
from pathlib import PurePath

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.models import DocumentVersion, ExportRecord
from payproof.services.export import zip_key
from payproof.storage.s3 import Storage


def _pdf(title: str) -> bytes:
    text = title.encode("ascii", "replace")
    return (
        b"%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >> endobj\n"
        b"% PayProof demo placeholder: " + text + b"\n%%EOF\n"
    )


def _xlsx(title: str) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr("xl/workbook.xml", f"<workbook><!-- {title} --></workbook>")
    return buf.getvalue()


@cache
def placeholder(file_name: str) -> bytes:
    title = f"PayProof demo: {file_name}"
    match PurePath(file_name).suffix.lower():
        case ".pdf":
            return _pdf(title)
        case ".jpg" | ".jpeg":
            return b"\xff\xd8\xff\xe0" + title.encode()  # magic + label, not a real image
        case ".png":
            return b"\x89PNG\r\n\x1a\n" + title.encode()
        case ".csv":
            return f"demo;fayl\n{file_name};1\n".encode()
        case ".xlsx":
            return _xlsx(title)
    raise ValueError(f"no placeholder for {file_name}")


async def store_placeholders(storage: Storage, versions: Sequence[DocumentVersion]) -> None:
    for v in versions:
        await storage.put(v.storage_key, placeholder(v.file_name), v.mime)


async def store_demo_files(session: AsyncSession, storage: Storage) -> None:
    """Every seeded document version, plus a zip for every seeded export (its download opens)."""
    await store_placeholders(storage, (await session.scalars(select(DocumentVersion))).all())
    for e in await session.scalars(select(ExportRecord)):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as z:
            z.writestr("manifest.json", json.dumps({"files": e.files}, ensure_ascii=False))
            for f in e.files:
                z.writestr(f"{f['type']}/{f['file_name']}", placeholder(f["file_name"]))
        await storage.put(zip_key(e.manifest_key), buf.getvalue(), "application/zip")
