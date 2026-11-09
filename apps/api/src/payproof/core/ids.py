import os
import time
import uuid

_VERSION = 0x7 << 76
_VARIANT = 0b10 << 62
_RANDOM_MASK = ((1 << 80) - 1) & ~(0xF << 76) & ~(0b11 << 62)


def uuid7() -> uuid.UUID:
    """RFC 9562 UUIDv7: 48-bit unix ms + random, sortable by time (stdlib only from 3.14)."""
    ms = time.time_ns() // 1_000_000
    rand = int.from_bytes(os.urandom(10)) & _RANDOM_MASK
    return uuid.UUID(int=(ms << 80) | _VERSION | _VARIANT | rand)
