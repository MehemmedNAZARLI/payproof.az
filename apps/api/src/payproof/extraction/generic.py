"""ADR-0011 schema-driven extraction: the shape a configured document type expects, and the
check every result passes before it is stored — whoever produced it (seed, mock, an AI provider).

A stored value always has a source (`field` / `table[i]` → page + quote); an unread key is null
and listed in `unreadable`. Anything outside the registry schema is refused, never stored."""

import datetime as dt
import re
from dataclasses import dataclass
from typing import Any

from payproof.domain.enums import Currency
from payproof.extraction.base import InvalidExtraction

MONEY = re.compile(r"^(0|[1-9][0-9]{0,15})\.[0-9]{2}\Z")  # NUMERIC(18,2), unsigned
INTEGER = re.compile(r"^-?[0-9]{1,18}\Z")
DECIMAL = re.compile(r"^-?[0-9]{1,15}(\.[0-9]{1,3})?\Z")
PARTY_PARTS = {"name", "tax_id", "id_number"}
MAX_QUOTE = 500


@dataclass(frozen=True)
class GenericData:
    fields: dict[str, Any]
    unreadable: list[str]
    tables: dict[str, list[dict[str, Any]]]
    evidence: dict[str, dict[str, Any]]  # key → {page, quote}


def _scalar_ok(kind: str, v: Any) -> bool:
    if kind in ("money",):
        return isinstance(v, str) and bool(MONEY.match(v))
    if kind == "date":
        try:
            return isinstance(v, str) and dt.date.fromisoformat(v).isoformat() == v
        except ValueError:
            return False
    if kind == "currency":
        return v in set(Currency)
    if kind == "integer":
        return isinstance(v, str) and bool(INTEGER.match(v))
    if kind == "decimal":
        return isinstance(v, str) and bool(DECIMAL.match(v))
    if kind == "boolean":
        return isinstance(v, bool)
    if kind == "party":
        return (isinstance(v, dict) and set(v) <= PARTY_PARTS and "name" in v
                and all(isinstance(x, str) or x is None for x in v.values()))  # fmt: skip
    return isinstance(v, str) and len(v) <= 1000  # text


def _source(data: GenericData, key: str, pages: int) -> None:
    e = data.evidence.get(key)
    if e is None:
        raise InvalidExtraction(f"{key}: value without a source")
    page, quote = e.get("page"), e.get("quote")
    if not isinstance(page, int) or not 1 <= page <= pages:
        raise InvalidExtraction(f"{key}: source on page {page} of a {pages}-page file")
    if not isinstance(quote, str) or not quote.strip() or len(quote) > MAX_QUOTE:
        raise InvalidExtraction(f"{key}: source quote missing or too long")


def validate_generic(data: GenericData, extraction: dict[str, Any], pages: int) -> None:
    """Raise InvalidExtraction (→ retry, then FAILED) unless `data` fits the type's schema."""
    fields = {f["key"]: f for f in extraction["fields"]}
    lists = {t["key"]: t for t in [*extraction.get("tables", []),
                                   *extraction.get("transaction_lists", [])]}  # fmt: skip
    for k in set(data.fields) - set(fields):
        raise InvalidExtraction(f"unknown field {k}")
    for k in set(data.tables) - set(lists):
        raise InvalidExtraction(f"unknown table {k}")
    for k in data.unreadable:
        if k not in fields and k not in lists:
            raise InvalidExtraction(f"unknown unreadable key {k}")
        if data.fields.get(k) is not None:
            raise InvalidExtraction(f"{k}: unreadable but has a value")
    for k, v in data.fields.items():
        if v is None:
            continue
        if not _scalar_ok(fields[k]["type"], v):
            raise InvalidExtraction(f"{k}: not a valid {fields[k]['type']}")
        _source(data, k, pages)
    for k, rows in data.tables.items():
        columns = {c["key"]: c for c in lists[k]["columns"]}
        for i, row in enumerate(rows):
            for c, v in row.items():
                if c not in columns:
                    raise InvalidExtraction(f"{k}[{i}]: unknown column {c}")
                if v is not None and not _scalar_ok(columns[c]["type"], v):
                    raise InvalidExtraction(f"{k}[{i}].{c}: not a valid {columns[c]['type']}")
            _source(data, f"{k}[{i}]", pages)
