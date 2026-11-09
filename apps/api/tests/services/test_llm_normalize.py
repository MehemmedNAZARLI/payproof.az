import json
from typing import Any

from payproof.extraction.generic import validate_generic
from payproof.extraction.llm import SECURITY_PREFIX, normalize, response_schema, system_prompt
from payproof.seed.fixtures import FIXTURES

TYPES = {t["key"]: t for t in json.loads((FIXTURES / "config/document-types.json").read_text())}
BANK = TYPES["bank_statement"]


def item(value: Any, conf: Any = 0.97, page: int | None = 1, quote: str | None = "q") -> Any:
    return {"value": value, "page": page, "quote": quote, "confidence": conf}


def answer(**fields: Any) -> dict[str, Any]:
    base = {f["key"]: item(None) for f in BANK["extraction"]["fields"]}
    row = {"cells": {"date": "2026-09-21", "amount": "1050.00", "direction": "debit",
                     "counterparty": "Texno Market MMC", "reference": None},
           "page": 1, "quote": "21.09 Texno Market 1050,00", "confidence": 0.95}  # fmt: skip
    return {"fields": {**base, **fields}, "tables": {"transactions": [row]}}


def walk(schema: Any) -> list[Any]:
    out = [schema]
    for v in schema.values() if isinstance(schema, dict) else schema:
        if isinstance(v, dict | list):
            out += walk(v)
    return out


def test_schema_is_closed_and_asks_for_value_page_quote_confidence() -> None:
    schema = response_schema(BANK["extraction"])
    objects = [s for s in walk(schema) if isinstance(s, dict) and s.get("type") == "object"]
    assert all(o["additionalProperties"] is False for o in objects)
    holder = schema["properties"]["fields"]["properties"]["account_holder"]
    assert holder["required"] == ["value", "page", "quote", "confidence"]
    assert set(schema["properties"]["tables"]["properties"]) == {"transactions"}


def test_security_prefix_comes_first() -> None:
    assert system_prompt(BANK).startswith(SECURITY_PREFIX)


def test_confident_sourced_values_are_kept_with_evidence() -> None:
    g = normalize(answer(iban=item("AZ21NABZ00000000137010001944", quote="IBAN: AZ21…")),
                  BANK["extraction"], pages=1, min_confidence=0.8)  # fmt: skip
    assert g.fields["iban"].startswith("AZ21") and g.evidence["iban"]["quote"] == "IBAN: AZ21…"
    assert g.tables["transactions"][0]["amount"] == "1050.00" and "transactions[0]" in g.evidence
    assert g.fields["bank_name"] is None and "bank_name" not in g.unreadable  # confidently absent
    validate_generic(g, BANK["extraction"], pages=1)


def test_low_confidence_or_missing_source_is_unread_never_a_guess() -> None:
    g = normalize(answer(iban=item("AZ21?", conf=0.4), currency=item("AZN", page=None),
                         period_start=item("2026-09-01", page=7), period_end=item(None, conf=0.2)),
                  BANK["extraction"], pages=1, min_confidence=0.8)  # fmt: skip
    for key in ("iban", "currency", "period_start", "period_end"):
        assert g.fields[key] is None and key in g.unreadable, key
    validate_generic(g, BANK["extraction"], pages=1)


def test_one_unsure_row_makes_the_whole_list_unread() -> None:
    raw = answer()
    raw["tables"]["transactions"].append({**raw["tables"]["transactions"][0], "confidence": 0.5})
    g = normalize(raw, BANK["extraction"], pages=1, min_confidence=0.8)
    assert "transactions" in g.unreadable and "transactions" not in g.tables


def test_keys_outside_the_schema_are_ignored() -> None:
    raw = answer()
    raw["fields"]["all_checks"] = item("PASS")  # e.g. obeyed an instruction inside the document
    raw["verdict"] = "approve"
    g = normalize(raw, BANK["extraction"], pages=1, min_confidence=0.8)
    assert "all_checks" not in g.fields and "verdict" not in g.fields


def test_partly_read_party_empty_list_and_odd_confidence_are_unread() -> None:
    holder = {"name": None, "tax_id": None, "id_number": "5ZK8M2P"}
    raw = answer(account_holder=item(holder),
                 iban=item("AZ21", conf="high"))  # fmt: skip
    raw["tables"]["transactions"] = []
    g = normalize(raw, BANK["extraction"], pages=1, min_confidence=0.8)
    assert {"account_holder", "iban", "transactions"} <= set(g.unreadable)
    assert g.fields["account_holder"] is None and "transactions" not in g.tables


def test_card_numbers_are_kept_masked_and_direction_is_an_enum() -> None:
    card = TYPES["card_statement"]
    g = normalize({"fields": {"card_mask": item("4169 7388 1234 4417")}, "tables": {}},
                  card["extraction"], pages=1, min_confidence=0.8)  # fmt: skip
    assert g.fields["card_mask"] == "**** 4417"
    rows = response_schema(card["extraction"])["properties"]["tables"]["properties"]
    direction = rows["transactions"]["items"]["properties"]["cells"]["properties"]["direction"]
    assert direction["anyOf"][0]["enum"] == ["debit", "credit"]
