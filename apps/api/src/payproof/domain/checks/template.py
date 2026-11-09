"""Output template values (ADR-0011 §4) — port of packages/mocks/src/checks/template.ts.
Only mapped placeholders, only from validated sources; any missing value refuses the export."""

from decimal import Decimal
from typing import Any

from payproof.domain.checks.values import (
    Json,
    amount,
    currency_of,
    decimal_str,
    docs_of,
    js_str,
    read,
)


def _value(p: Json, s: Json, approval: Json | None) -> str | None:
    kind = s["kind"]
    if kind == "package":
        return str(p["reference"])
    if kind == "approval":
        return None if approval is None else approval.get(s["value"])
    docs = docs_of(p, s["document_type"])
    if kind == "field":
        r = read(docs[0], s["field"]) if len(docs) == 1 else None
        return js_str(r.value) if r is not None and r.status == "ok" else None
    if s["op"] == "count":
        return str(len(docs))
    reads = [(read(d, s.get("field") or ""), currency_of(d)) for d in docs]
    currencies = list(dict.fromkeys(cur for _, cur in reads))
    if (
        not docs
        or len(currencies) != 1
        or not currencies[0]
        or any(r.status != "ok" for r, _ in reads)
    ):
        return None
    total = sum((amount(js_str(r.value)) for r, _ in reads), Decimal("0.00"))
    return f"{decimal_str(total)} {currencies[0]}"


def fill_template(p: Json, rs: Json, approval: Json | None) -> dict[str, list[Any]]:
    """Values for every mapped placeholder; `missing` non-empty → export refused (422)."""
    fill: dict[str, list[Any]] = {"values": [], "missing": []}
    for m in (rs.get("output") or {}).get("placeholders", []):
        value = _value(p, m["source"], approval)
        if value is None:
            fill["missing"].append({"placeholder": m["placeholder"], "source": m["source"]})
        else:
            fill["values"].append({"placeholder": m["placeholder"], "value": value})
    return fill
