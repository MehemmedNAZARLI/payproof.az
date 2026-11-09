"""Requirement set configuration check (ADR-0011): the rules of fixtures/validate-config.mjs,
applied when an approver saves a set. Pure — the caller passes the registry and the library."""

from collections.abc import Iterator

from payproof.domain.checks.params import (
    CHECK_ID,
    PARTY_PARTS,
    TXN_COLUMNS,
    Json,
    param_ok,
    references,
)


class ConfigError(ValueError):
    def __init__(self, errors: dict[str, str]) -> None:
        super().__init__("; ".join(f"{k}: {v}" for k, v in errors.items()))
        self.errors = errors


def validate_config(
    documents: list[Json],
    checks: list[Json],
    output: Json | None,
    *,
    registry: dict[str, Json],
    library: Json,
    template_placeholders: set[str] | None,
) -> None:
    """Raise ConfigError({path: Azerbaijani message}) on the first pass's every problem."""
    v = _Validator(registry, library)
    v.documents(documents)
    v.checks(checks)
    v.output(output, template_placeholders)
    if v.errors:
        raise ConfigError(v.errors)


class _Validator:
    def __init__(self, registry: dict[str, Json], library: Json) -> None:
        self.registry = registry
        self.families = {f["type"]: f for f in library["families"]}
        self.errors: dict[str, str] = {}
        self.docs: dict[str, Json] = {}
        self.present: set[str] = set()

    def fail(self, path: str, message: str) -> None:
        self.errors.setdefault(path, message)

    def field_type(self, doc_type: str, field: str) -> str | None:
        top, _, part = field.partition(".")
        fields = self.registry[doc_type]["extraction"]["fields"]
        f = next((x for x in fields if x["key"] == top), None)
        if f is None or (part and (f["type"] != "party" or part not in PARTY_PARTS)):
            return None
        return "text" if part else str(f["type"])

    def columns(self, doc_type: str, key: str) -> set[str] | None:
        x = self.registry[doc_type]["extraction"]
        lists = [*x.get("tables", []), *x.get("transaction_lists", [])]
        found = next((t for t in lists if t["key"] == key), None)
        return None if found is None else {c["key"] for c in found["columns"]}

    def documents(self, documents: list[Json]) -> None:
        for i, d in enumerate(documents):
            if d["type"] not in self.registry:
                self.fail(f"documents[{i}].type", f"naməlum sənəd növü: {d['type']}")
            elif d["type"] in self.docs:
                self.fail(f"documents[{i}].type", f"sənəd növü təkrarlanır: {d['type']}")
            else:
                self.docs[d["type"]] = d
            if d["max_count"] is not None and d["max_count"] < d["min_count"]:
                self.fail(f"documents[{i}].max_count", "max_count min_count-dan kiçikdir")

    def checks(self, checks: list[Json]) -> None:
        seen: set[str] = set()
        for i, c in enumerate(checks):
            at = f"checks[{i}]"
            if c["id"].startswith("R-") or c["id"] == "D-001" or not CHECK_ID.match(c["id"]):
                self.fail(f"{at}.id", "R- və D-001 identifikatorları sistemə aiddir")
            elif c["id"] in seen:
                self.fail(f"{at}.id", f"yoxlama identifikatoru təkrarlanır: {c['id']}")
            seen.add(c["id"])
            fam = self.families.get(c["type"])
            if fam is None:
                self.fail(f"{at}.type", f"naməlum yoxlama ailəsi: {c['type']}")
            elif fam["system"]:
                self.fail(f"{at}.type", f"{c['type']} konfiqurasiya edilmir (sistem yoxlaması)")
            else:
                self.parameters(at, fam, c["parameters"])

    def parameters(self, at: str, fam: Json, params: Json) -> None:
        defs = {p["name"]: p for p in fam["parameters"]}
        bad = False
        for name, p in defs.items():
            if name not in params:
                bad |= p["required"]
                if p["required"]:
                    self.fail(f"{at}.parameters.{name}", "məcburi parametr")
            elif not param_ok(p["type"], params[name]):
                bad = True
                self.fail(f"{at}.parameters.{name}", f"yanlış dəyər ({p['type']})")
        for name in params.keys() - defs.keys():
            self.fail(f"{at}.parameters.{name}", "naməlum parametr")
        if bad:
            return  # shapes are wrong: references cannot be followed safely
        problems = list(dict.fromkeys(self.references(fam["type"], params)))
        if problems:
            self.fail(f"{at}.parameters", "; ".join(problems))
        elif fam["type"] == "field_present":
            self.present |= {f"{t['document_type']}.{t['field']}" for t in params["targets"]}

    def references(self, family: str, p: Json) -> Iterator[str]:
        for doc_type, field, key in references(p):
            if doc_type not in self.docs:
                yield f"{doc_type} documents[]-də yoxdur"
            elif field and self.field_type(doc_type, field) is None:
                yield f"naməlum sahə {doc_type}.{field}"
            elif key and self.columns(doc_type, key) is None:
                yield f"naməlum siyahı {doc_type}.{key}"
        sides: list[tuple[Json, str, list[str]]] = []
        if family == "totals_sum":
            sides = [(p, p["table"], [p["amount_column"]])]
        elif family == "line_items_match":
            cols = [p["key_column"], *p["compare"]]
            sides = [(p["left"], p["left"]["table"], cols), (p["right"], p["right"]["table"], cols)]
        elif family == "transaction_match":
            sides = [(a, a["list"], list(TXN_COLUMNS)) for a in p["against"]]
        for ref, key, cols in sides:
            have = (
                self.columns(ref["document_type"], key)
                if ref["document_type"] in self.docs
                else None
            )
            for col in [] if have is None else [c for c in cols if c not in have]:
                yield f"naməlum sütun {ref['document_type']}.{key}.{col}"
        if family == "date_within_period":
            for b in (p["period"]["from"], p["period"]["to"]):
                if (
                    isinstance(b, dict)
                    and self.docs.get(b["document_type"], {}).get("max_count") != 1
                ):
                    yield "dövr sərhədi max_count 1 olan sənəd növündən olmalıdır"

    def output(self, output: Json | None, template: set[str] | None) -> None:
        if output is None:
            return
        if template is None:
            self.fail("output.template", "şablon bu müştəri üçün yüklənməyib")
        seen: set[str] = set()
        for i, m in enumerate(output["placeholders"]):
            at, name, src = f"output.placeholders[{i}]", m["placeholder"], m["source"]
            if name in seen:
                self.fail(at, f"{name} iki dəfə xəritələnib")
            seen.add(name)
            if template is not None and name not in template:
                self.fail(at, f"{name} şablonda yoxdur")
            if src["kind"] in ("field", "aggregate") and src.get("document_type") not in self.docs:
                self.fail(at, f"{src.get('document_type')} documents[]-də yoxdur")
            elif src["kind"] == "field":
                ref = f"{src['document_type']}.{src.get('field')}"
                if self.docs[src["document_type"]]["max_count"] != 1:
                    self.fail(at, "field mənbəyi max_count 1 olan sənəd növündən olmalıdır")
                elif ref not in self.present:
                    self.fail(at, f"{ref} field_present hədəfi deyil")
            elif (
                src["kind"] == "aggregate"
                and src.get("op") == "sum"
                and self.field_type(src["document_type"], src.get("field") or "") != "money"
            ):
                self.fail(at, "sum yalnız money sahəsi üçündür")
