"""Parameter shapes of the check library families and the references inside them."""

import re
from collections.abc import Callable, Iterator
from typing import Any

MONEY = re.compile(r"^-?(0|[1-9][0-9]*)\.[0-9]{2}\Z")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}\Z")
CHECK_ID = re.compile(r"^[A-Z]{1,4}-[0-9]{2,3}\Z")
PARTY_PARTS = {"name", "tax_id", "id_number"}
CURRENCIES = {"AZN", "USD"}
TXN_COLUMNS = ("date", "amount", "direction", "counterparty")
Json = dict[str, Any]


def _obj(v: Any, *keys: str) -> bool:
    return isinstance(v, dict) and all(isinstance(v.get(k), str) and v[k] for k in keys)


def _list(v: Any, item: Callable[[Any], bool]) -> bool:
    return isinstance(v, list) and len(v) > 0 and all(item(x) for x in v)


def param_ok(kind: str, v: Any) -> bool:
    if kind.startswith("enum:"):
        return v in kind[5:].split(",")
    if kind.startswith("enum_list:"):
        return _list(v, lambda x: x in kind[10:].split(","))
    checks: dict[str, Callable[[Any], bool]] = {
        "field_ref": lambda x: _obj(x, "document_type", "field"),
        "field_refs": lambda x: _list(x, lambda r: _obj(r, "document_type", "field")),
        "decimal": lambda x: isinstance(x, str) and bool(MONEY.match(x)) and x[0] != "-",
        "document_type": lambda x: isinstance(x, str) and bool(x),
        "string": lambda x: isinstance(x, str) and bool(x),
        "strings": lambda x: _list(x, lambda s: isinstance(s, str) and bool(s)),
        "integer": lambda x: isinstance(x, int) and not isinstance(x, bool) and x >= 0,
        "money": lambda x: _obj(x, "amount", "currency")
        and bool(MONEY.match(x["amount"])) and x["currency"] in CURRENCIES,
        "period": lambda x: isinstance(x, dict) and all(
            (isinstance(b, str) and bool(DATE.match(b))) or _obj(b, "document_type", "field")
            for b in (x.get("from"), x.get("to"))
        ),
        "table_ref": lambda x: _obj(x, "document_type", "table"),
        "list_refs": lambda x: _list(x, lambda r: _obj(r, "document_type", "list")),
        "match_source": lambda x: _obj(
            x, "document_type", "amount_field", "date_field", "counterparty_field"
        ),
        "subjects": lambda x: _list(
            x, lambda s: _obj(s, "document_type") and _list(s.get("key_fields"), _obj_str)
        ),
    }  # fmt: skip
    return checks[kind](v)


def _obj_str(v: Any) -> bool:
    return isinstance(v, str) and bool(v)


def references(value: Any) -> Iterator[tuple[str, str | None, str | None]]:
    """(document_type, field, list) of every reference inside check parameters."""
    if isinstance(value, list):
        for v in value:
            yield from references(v)
    elif isinstance(value, dict):
        if isinstance(value.get("document_type"), str):
            t = value["document_type"]
            yield (
                t,
                value.get("field", value.get("amount_field")),
                value.get("list", value.get("table")),
            )
            for k in ("date_field", "counterparty_field", "total_field"):
                if value.get(k):
                    yield t, value[k], None
            for k in value.get("key_fields") or []:
                yield t, k, None
        for v in value.values():
            if isinstance(v, dict | list):
                yield from references(v)
