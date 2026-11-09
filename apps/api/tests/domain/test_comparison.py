import uuid
from decimal import Decimal
from typing import Any

from payproof.domain.snapshot import DeliveryLine
from payproof.services.comparison import comparison_rows
from tests.domain.builders import delivery, snapshot

FIELD = uuid.UUID(int=7)


def _rows(**over: object) -> dict[str, dict[str, Any]]:
    s = snapshot(**over)
    rows = comparison_rows(
        s, descriptions={"GY-1L": "Günəbaxan yağı, 1 L"}, field_ids={"invoice.po_ref": FIELD}
    )
    return {r.key: r.model_dump() for r in rows}


def test_clean_package_is_all_ok() -> None:
    rows = _rows(
        delivery=delivery(
            lines=(DeliveryLine("GY-1L", Decimal("800")), DeliveryLine("DY-5", Decimal("400")))
        )
    )
    assert list(rows) == [
        "po_ref", "customer", "currency",
        "lines[GY-1L].qty", "lines[GY-1L].unit_price", "lines[DY-5].qty", "lines[DY-5].unit_price",
        "total",
    ]  # fmt: skip
    po = rows["po_ref"]
    assert (po["invoice"]["value"], po["invoice"]["state"], po["invoice"]["field_id"]) == (
        "PO-381",
        "ok",
        FIELD,
    )
    assert rows["lines[GY-1L].qty"]["group"] == "GY-1L · Günəbaxan yağı, 1 L"
    assert rows["lines[GY-1L].unit_price"]["invoice"] == {
        "value": "9.00", "currency": "AZN", "state": "ok", "field_id": None, "evidence": None,
    }  # fmt: skip
    assert rows["total"]["order"]["value"] == "12000.00"
    assert all(
        c["state"] in ("ok", "empty")
        for r in rows.values()
        for c in (r["invoice"], r["order"], r["delivery"])
    )
