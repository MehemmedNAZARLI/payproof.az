"""Upload checks (security.md): type by content (magic bytes), never by name; size and page
limits. Nothing in the file is executed — an XLSX is only listed as a zip here."""

import hashlib
import io
import re
import zipfile
from dataclasses import dataclass

from payproof.core.errors import FileTooLarge, UnsupportedFileType

MAX_MB = 20
MAX_BYTES = MAX_MB * 1024 * 1024
MAX_PAGES = 50
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
# shortcut: counts page objects in the raw bytes; compressed object streams hide them (count
# too low, never too high) — switch to PyMuPDF's page count when B-15 adds it
_PDF_PAGE = re.compile(rb"/Type\s*/Page(?![a-zA-Z])")


@dataclass(frozen=True)
class FileInfo:
    mime: str
    source_kind: str  # pdf | scan | spreadsheet
    pages: int | None
    sha256: str


def _is_xlsx(data: bytes) -> bool:
    try:
        names = set(zipfile.ZipFile(io.BytesIO(data)).namelist())
    except zipfile.BadZipFile:
        return False
    return "[Content_Types].xml" in names and "xl/workbook.xml" in names


def _is_csv(data: bytes) -> bool:
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return False
    first = text.split("\n", 1)[0]
    return "\0" not in text and text.strip() != "" and ("," in first or ";" in first)


def _kind(data: bytes) -> tuple[str, str]:
    if data.startswith(b"%PDF-"):
        return "application/pdf", "pdf"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", "scan"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", "scan"
    if data.startswith(b"PK\x03\x04") and _is_xlsx(data):
        return XLSX, "spreadsheet"
    if _is_csv(data):
        return "text/csv", "spreadsheet"
    raise UnsupportedFileType


def inspect(data: bytes) -> FileInfo:
    if len(data) > MAX_BYTES:
        raise FileTooLarge(details={"max_mb": MAX_MB})
    mime, kind = _kind(data)
    pages = {"pdf": len(_PDF_PAGE.findall(data)) or 1, "scan": 1}.get(kind)
    if pages and pages > MAX_PAGES:
        raise FileTooLarge(f"Faylda {MAX_PAGES} səhifədən çox var.", {"max_pages": MAX_PAGES})
    return FileInfo(mime, kind, pages, hashlib.sha256(data).hexdigest())
