import copy
import json
from typing import Any

import pytest

from payproof.extraction.base import InvalidExtraction
from payproof.extraction.generic import GenericData, validate_generic
from payproof.seed.fixtures import FIXTURES

REGISTRY = {t["key"]: t for t in json.loads((FIXTURES / "config/document-types.json").read_text())}
DOCS = [d for p in json.loads((FIXTURES / "scenarios/unec.json").read_text())["packages"]
        for d in p["documents"]]  # fmt: skip


def check(d: dict[str, Any]) -> None:
    data = GenericData(d["fields"], d["unreadable"], d["tables"], d["evidence"])
    validate_generic(data, REGISTRY[d["type"]]["extraction"], d["pages"])


@pytest.mark.parametrize("doc", DOCS, ids=lambda d: d["id"])
def test_every_unec_document_fits_its_registry_schema(doc: dict[str, Any]) -> None:
    check(doc)


@pytest.mark.parametrize(
    ("mutate", "error"),
    [
        (lambda d: d["fields"].update(iban_extra="x"), "unknown field iban_extra"),
        (lambda d: d["fields"].update(total="1,050.00"), "total: not a valid money"),
        (lambda d: d["fields"].update(invoice_date="20.09.2026"), "invoice_date: not a valid date"),
        (lambda d: d["fields"].update(currency="EUR"), "currency: not a valid currency"),
        (lambda d: d["evidence"].pop("total"), "total: value without a source"),
        (lambda d: d["evidence"]["total"].update(page=2), "total: source on page 2"),
        (lambda d: d["evidence"]["total"].update(quote=" "), "total: source quote missing"),
        (lambda d: d["unreadable"].append("total"), "total: unreadable but has a value"),
        (lambda d: d["tables"]["lines"][0].update(vat="18"), r"lines\[0\]: unknown column vat"),
        (lambda d: d["evidence"].pop("lines[0]"), r"lines\[0\]: value without a source"),
        (lambda d: d["fields"].update(seller={"name": "X", "iban": "AZ"}), "seller: not a valid"),
    ],
)
def test_out_of_schema_results_are_refused(mutate: Any, error: str) -> None:
    doc = copy.deepcopy(DOCS[1])  # TM-88017 invoice
    mutate(doc)
    with pytest.raises(InvalidExtraction, match=error):
        check(doc)


def test_unread_value_is_null_and_listed() -> None:
    doc = copy.deepcopy(DOCS[1])
    doc["fields"]["total"] = None
    doc["unreadable"].append("total")
    check(doc)
