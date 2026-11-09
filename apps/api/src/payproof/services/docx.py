"""`.docx` output templates: content check and `{{placeholder}}` discovery (ADR-0011 §4).

The file is a zip; only the parts Word renders text from are read, with a cap on the inflated
size (a template is small — a zip bomb is refused, never unpacked)."""

import io
import re
import zipfile

from payproof.core.errors import InvalidInput, UnsupportedFileType

PLACEHOLDER = re.compile(r"\{\{\s*([a-z][a-z0-9_]*)\s*\}\}")
_TEXT_PARTS = re.compile(r"^word/(document|header\d*|footer\d*)\.xml$")
_TAG = re.compile(r"<[^>]+>")
MAX_INFLATED = 20 * 1024 * 1024


def _parts(data: bytes) -> list[str]:
    try:
        z = zipfile.ZipFile(io.BytesIO(data))
        names = [i for i in z.infolist() if _TEXT_PARTS.match(i.filename)]
        if not any(i.filename == "word/document.xml" for i in z.infolist()):
            raise UnsupportedFileType("Yalnız .docx şablonu qəbul olunur.")
        if sum(i.file_size for i in names) > MAX_INFLATED:
            raise InvalidInput("Şablon çox böyükdür.", {"fields": {"file": "≤ 20 MB açılmış"}})
        return [z.read(i).decode("utf-8") for i in names]
    except (zipfile.BadZipFile, UnicodeDecodeError, KeyError) as e:
        raise UnsupportedFileType("Yalnız .docx şablonu qəbul olunur.") from e


def placeholders(data: bytes) -> list[str]:
    """Distinct placeholders in order of appearance. Word may split `{{name}}` across runs, so
    the text is read per part with the XML tags removed."""
    found: dict[str, None] = {}
    for xml in _parts(data):
        for m in PLACEHOLDER.finditer(_TAG.sub("", xml)):
            found[f"{{{{{m.group(1)}}}}}"] = None
    return list(found)
