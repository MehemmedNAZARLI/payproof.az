import time
import uuid

from payproof.core.ids import uuid7


def test_uuid7_version_and_variant() -> None:
    u = uuid7()
    assert u.version == 7
    assert u.variant == uuid.RFC_4122


def test_uuid7_embeds_unix_ms_and_sorts_by_time() -> None:
    before = time.time_ns() // 1_000_000
    first = uuid7()
    time.sleep(0.002)
    second = uuid7()
    assert before <= first.int >> 80 <= before + 1000
    assert first < second


def test_uuid7_is_unique() -> None:
    assert len({uuid7() for _ in range(1000)}) == 1000
