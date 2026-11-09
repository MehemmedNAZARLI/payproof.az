import io
import zipfile

import pytest

from payproof.core.errors import InvalidInput, UnsupportedFileType
from payproof.services import docx


def pack(parts: dict[str, str]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name, xml in parts.items():
            z.writestr(name, xml)
    return buf.getvalue()


def test_placeholders_split_across_runs_and_in_headers() -> None:
    body = "<w:p><w:r><w:t>{{gran</w:t></w:r><w:r><w:t>tee_name}}</w:t></w:r></w:p>"
    data = pack({"word/document.xml": body, "word/header1.xml": "<w:t>{{ref}} {{ref}}</w:t>"})
    assert docx.placeholders(data) == ["{{grantee_name}}", "{{ref}}"]


def test_only_word_documents_are_accepted() -> None:
    with pytest.raises(UnsupportedFileType):
        docx.placeholders(b"%PDF-1.4")
    with pytest.raises(UnsupportedFileType):
        docx.placeholders(pack({"xl/workbook.xml": "<x/>"}))


def test_inflated_size_is_capped(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(docx, "MAX_INFLATED", 100)
    with pytest.raises(InvalidInput):
        docx.placeholders(pack({"word/document.xml": "<w:t>" + "a" * 500 + "</w:t>"}))
