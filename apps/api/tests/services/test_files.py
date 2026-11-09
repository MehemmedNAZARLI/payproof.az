import io
import zipfile

import pytest

from payproof.core.errors import FileTooLarge, UnsupportedFileType
from payproof.services.files import MAX_BYTES, inspect


def _pdf(pages: int) -> bytes:
    body = b"".join(b"%d 0 obj << /Type /Page >> endobj\n" % i for i in range(pages))
    return b"%PDF-1.7\n1 0 obj << /Type /Pages /Count 1 >> endobj\n" + body + b"%%EOF"


def _xlsx() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr("xl/workbook.xml", "<workbook/>")
    return buf.getvalue()


@pytest.mark.parametrize(
    ("data", "mime", "kind", "pages"),
    [
        (_pdf(2), "application/pdf", "pdf", 2),
        (b"\x89PNG\r\n\x1a\n" + b"\0" * 20, "image/png", "scan", 1),
        (b"\xff\xd8\xff\xe0" + b"\0" * 20, "image/jpeg", "scan", 1),
        ("kod;miqdar\nPRD-1;5\nŞüşə;2\n".encode(), "text/csv", "spreadsheet", None),
        (
            _xlsx(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "spreadsheet",
            None,
        ),
    ],
)
def test_type_comes_from_the_content(data: bytes, mime: str, kind: str, pages: int | None) -> None:
    f = inspect(data)
    assert (f.mime, f.source_kind, f.pages) == (mime, kind, pages)
    assert len(f.sha256) == 64


@pytest.mark.parametrize(
    "data",
    [
        b"MZ\x90\x00" + b"\0" * 60,  # a Windows .exe, whatever its name says
        b"PK\x03\x04" + b"\0" * 30,  # a zip that is not a workbook
        b"\x00\x01binary\xff\xfe",
        b"",
    ],
)
def test_other_content_is_rejected(data: bytes) -> None:
    with pytest.raises(UnsupportedFileType):
        inspect(data)


def test_limits() -> None:
    with pytest.raises(FileTooLarge) as too_big:
        inspect(b"%PDF-" + b"\0" * MAX_BYTES)
    assert too_big.value.details == {"max_mb": 20}
    with pytest.raises(FileTooLarge) as too_many:
        inspect(_pdf(51))
    assert too_many.value.details == {"max_pages": 50}
