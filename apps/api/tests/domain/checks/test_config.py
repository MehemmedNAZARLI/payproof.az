import copy
import json
from pathlib import Path
from typing import Any

import pytest

from payproof.domain.checks.config import ConfigError, validate_config

FIXTURES = Path(__file__).parents[5] / "fixtures"
REGISTRY = {t["key"]: t for t in json.loads((FIXTURES / "config/document-types.json").read_text())}
LIBRARY = json.loads((FIXTURES / "config/check-library.json").read_text())
UNEC = json.loads((FIXTURES / "scenarios/unec.json").read_text())["customer"]["requirement_sets"][0]
PLACEHOLDERS = {p["placeholder"] for p in UNEC["output"]["placeholders"]}


def run(rs: dict[str, Any], placeholders: set[str] | None = PLACEHOLDERS) -> None:
    validate_config(
        rs["documents"], rs["checks"], rs["output"],
        registry=REGISTRY, library=LIBRARY, template_placeholders=placeholders,
    )  # fmt: skip


def errors(mutate: Any, placeholders: set[str] | None = PLACEHOLDERS) -> dict[str, str]:
    rs = copy.deepcopy(UNEC)
    mutate(rs)
    with pytest.raises(ConfigError) as e:
        run(rs, placeholders)
    return e.value.errors


def test_unec_set_is_valid() -> None:
    run(UNEC)


def test_unknown_document_type() -> None:
    e = errors(lambda rs: rs["documents"].append({"type": "passport", "min_count": 1,
                                                  "max_count": 1}))  # fmt: skip
    assert e == {"documents[3].type": "naməlum sənəd növü: passport"}


def test_max_below_min_and_duplicate_type() -> None:
    def m(rs: dict[str, Any]) -> None:
        rs["documents"][0]["max_count"] = 0
        rs["documents"].append(dict(rs["documents"][1]))

    e = errors(m)
    assert e["documents[0].max_count"] == "max_count min_count-dan kiçikdir"
    assert e["documents[3].type"] == "sənəd növü təkrarlanır: bank_statement"


def test_reserved_and_duplicate_ids() -> None:
    def m(rs: dict[str, Any]) -> None:
        rs["checks"][0]["id"] = "R-001"
        rs["checks"][2]["id"] = rs["checks"][1]["id"]

    e = errors(m)
    assert e["checks[0].id"] == "R- və D-001 identifikatorları sistemə aiddir"
    assert e["checks[2].id"] == "yoxlama identifikatoru təkrarlanır: U-02"


def test_unknown_family_and_system_family() -> None:
    def m(rs: dict[str, Any]) -> None:
        rs["checks"][0]["type"] = "magic"
        rs["checks"][1]["type"] = "document_count"

    e = errors(m)
    assert e["checks[0].type"] == "naməlum yoxlama ailəsi: magic"
    assert e["checks[1].type"] == "document_count konfiqurasiya edilmir (sistem yoxlaması)"


def test_missing_unknown_and_malformed_parameters() -> None:
    def m(rs: dict[str, Any]) -> None:
        del rs["checks"][3]["parameters"]["tolerance"]
        rs["checks"][3]["parameters"]["extra"] = 1
        rs["checks"][5]["parameters"]["limit"] = {"amount": 1500, "currency": "AZN"}
        rs["checks"][6]["parameters"]["direction"] = "sideways"

    e = errors(m)
    assert e["checks[3].parameters.tolerance"] == "məcburi parametr"
    assert e["checks[3].parameters.extra"] == "naməlum parametr"
    assert e["checks[5].parameters.limit"] == "yanlış dəyər (money)"
    assert e["checks[6].parameters.direction"] == "yanlış dəyər (enum:debit,credit)"


def test_field_refs_must_exist_in_the_registry_and_documents() -> None:
    def m(rs: dict[str, Any]) -> None:
        rs["checks"][0]["parameters"]["targets"][0]["field"] = "invoice_nr"
        rs["checks"][0]["parameters"]["targets"][1]["field"] = "seller.iban"
        rs["checks"][0]["parameters"]["targets"][2]["document_type"] = "receipt"
        rs["checks"][3]["parameters"]["amount_column"] = "sum"

    e = errors(m)
    assert e["checks[0].parameters"] == (
        "naməlum sahə invoice.invoice_nr; naməlum sahə invoice.seller.iban; "
        "receipt documents[]-də yoxdur"
    )
    assert e["checks[3].parameters"] == "naməlum sütun invoice.lines.sum"


def test_period_bound_needs_a_single_document() -> None:
    e = errors(lambda rs: rs["documents"][1].update(max_count=2))
    assert e["checks[4].parameters"] == "dövr sərhədi max_count 1 olan sənəd növündən olmalıdır"


def test_placeholder_rules() -> None:
    def m(rs: dict[str, Any]) -> None:
        ph = rs["output"]["placeholders"]
        ph[1]["source"]["field"] = "iban"  # not a field_present target
        ph[2] = dict(ph[3])  # mapped twice
        ph[6]["source"] = {"kind": "aggregate", "op": "sum", "document_type": "invoice",
                           "field": "invoice_date"}  # fmt: skip

    e = errors(m)
    assert e["output.placeholders[1]"] == "bank_statement.iban field_present hədəfi deyil"
    assert e["output.placeholders[3]"] == "{{period_start}} iki dəfə xəritələnib"
    assert e["output.placeholders[6]"] == "sum yalnız money sahəsi üçündür"


def test_template_must_be_uploaded_and_contain_every_placeholder() -> None:
    e = errors(lambda rs: None, placeholders=None)
    assert e == {"output.template": "şablon bu müştəri üçün yüklənməyib"}
    e = errors(lambda rs: None, placeholders=PLACEHOLDERS - {"{{grantee_fin}}"})
    assert e == {"output.placeholders[2]": "{{grantee_fin}} şablonda yoxdur"}


def test_amounts_and_dates_must_have_fitting_types() -> None:
    def m(rs: dict[str, Any]) -> None:
        rs["checks"][5]["parameters"]["target"]["field"] = "invoice_number"
        rs["checks"][4]["parameters"]["target"]["field"] = "total"
        rs["checks"][3]["parameters"]["amount_column"] = "description"
        rs["checks"][6]["parameters"]["source"]["date_field"] = "invoice_number"

    e = errors(m)
    assert e["checks[5].parameters"] == "invoice.invoice_number money sahəsi olmalıdır"
    assert e["checks[4].parameters"] == "invoice.total date sahəsi olmalıdır"
    assert e["checks[3].parameters"] == "lines.description money sütunu olmalıdır"
    assert e["checks[6].parameters"] == "invoice.invoice_number date sahəsi olmalıdır"
