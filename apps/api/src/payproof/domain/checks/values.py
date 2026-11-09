"""Reading extracted values for the check library — port of packages/mocks/src/checks/read.ts and
verdict.ts. A value is usable only if it was read *and* has a source; money is Decimal, never float.
Documents are plain dicts in the scenario shape (fields, unreadable, tables, evidence)."""

import datetime as dt
import re
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

Json = dict[str, Any]
MONEY = re.compile(r"^-?(0|[1-9][0-9]*)\.[0-9]{2}\Z")


def amount(value: str) -> Decimal:
    """`"9.10"` → Decimal; anything but a 2-decimal string is a programming error upstream."""
    if not MONEY.match(value):
        raise ValueError(f"not a decimal string: {value!r}")
    return Decimal(value)


def decimal_str(d: Decimal) -> str:
    return f"{d + 0:.2f}" if d else "0.00"  # never "-0.00"


def money(d: Decimal, currency: str) -> Json:
    return {"amount": decimal_str(d), "currency": currency}


def fmt(d: Decimal, currency: str) -> str:
    return f"{decimal_str(d)} {currency}"


def js_str(v: Any) -> str:
    """JavaScript `String(v)` for the values a document holds (messages and keys must match)."""
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, dict):
        return "[object Object]"
    if isinstance(v, list):
        return ",".join("" if x is None else js_str(x) for x in v)
    return str(v)


def verdict(outcome: str, message: str, evidence: list[Json], data: Json | None = None) -> Json:
    v: Json = {"outcome": outcome, "message": message, "evidence": evidence}
    if data is not None:
        v["data"] = data
    return v


def na(message: str) -> Json:
    return verdict("NOT_APPLICABLE", message, [])


@dataclass(frozen=True)
class Read:
    status: str  # ok | unreadable | missing
    value: Any = None
    evidence: Json | None = None


def docs_of(p: Json, doc_type: str) -> list[Json]:
    return [d for d in p["documents"] if d["type"] == doc_type]


def cite(d: Json, key: str) -> Json | None:
    e = d["evidence"].get(key)
    return (
        {"document_id": d["id"], "field": key, "page": e["page"], "quote": e["quote"]}
        if e
        else None
    )


def whole(d: Json) -> Json:
    """First-page citation of a document as a whole (unread field without its own source)."""
    return {"document_id": d["id"], "field": "document", "page": 1, "quote": d["file_name"]}


def read(d: Json, field: str) -> Read:
    top, _, part = field.partition(".")
    if top in d["unreadable"]:
        return Read("unreadable", evidence=cite(d, top) or whole(d))
    value = d["fields"].get(top)
    if "." in field:
        value = value.get(part) if isinstance(value, dict) else None
    evidence = cite(d, top)
    if value is None or evidence is None:
        return Read("missing")
    return Read("ok", value, evidence)


def currency_of(d: Json) -> str | None:
    r = read(d, "currency")
    return js_str(r.value) if r.status == "ok" else None


def read_all(p: Json, ref: Json) -> list[tuple[Json, Read]]:
    return [(d, read(d, ref["field"])) for d in docs_of(p, ref["document_type"])]


_AZ = str.maketrans({"ə": "e", "ı": "i", "ö": "o", "ü": "u", "ş": "s", "ç": "c", "ğ": "g"})
_LEGAL = re.compile(r"\b(mmc|asc|qsc|llc|ltd)\b", re.ASCII)  # JS \b is ASCII-only
_MIN_NAME = 6  # shorter names match too much ("kitab" in every "KITAB …" descriptor)


def normalize_name(s: str) -> str:
    s = s.replace("İ", "i").lower().translate(_AZ)
    return re.sub(r"[^a-z0-9]", "", _LEGAL.sub("", s))


def same_counterparty(a: str, b: str) -> bool:
    x, y = normalize_name(a), normalize_name(b)
    if x == y:
        return len(x) > 0
    return min(len(x), len(y)) >= _MIN_NAME and (y in x or x in y)


def days_between(a: str, b: str) -> int | None:
    try:
        return (dt.date.fromisoformat(b) - dt.date.fromisoformat(a)).days
    except ValueError:
        return None  # JS Date.parse → NaN: every comparison is false
