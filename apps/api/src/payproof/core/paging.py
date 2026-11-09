"""Opaque page cursors (openapi `Cursor`): an encoded offset; a malformed one is a 400."""

import base64
import binascii

from payproof.core.errors import DomainError


def encode_cursor(offset: int) -> str:
    return base64.urlsafe_b64encode(str(offset).encode()).decode()


def decode_cursor(cursor: str | None) -> int:
    if not cursor:
        return 0
    try:
        offset = int(base64.urlsafe_b64decode(cursor.encode()).decode())
    except (binascii.Error, UnicodeDecodeError, ValueError):
        offset = -1
    if offset < 0:
        raise DomainError("Sorğu yanlışdır.", details={"fields": [{"loc": ["query", "cursor"]}]})
    return offset
