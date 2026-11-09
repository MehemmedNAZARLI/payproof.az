"""Fill a `.docx` output template (ADR-0011 §4) — only at its mapped placeholders.

docxtpl renders with a *sandboxed* Jinja environment (a template cannot reach Python objects),
autoescaped values (a value cannot inject Word XML) and an `undefined` that writes any unmapped
`{{name}}` back unchanged: the rest of the document is never touched."""

import io
from typing import Any

from docxtpl import DocxTemplate  # type: ignore[import-untyped]
from jinja2 import Undefined
from jinja2.sandbox import SandboxedEnvironment

from payproof.domain.checks.values import Json, cite, docs_of, read, whole


class _Keep(Undefined):
    def __str__(self) -> str:
        return f"{{{{{self._undefined_name}}}}}"


def render(template: bytes, values: dict[str, str]) -> bytes:
    """`values` maps `{{name}}` → text."""
    doc = DocxTemplate(io.BytesIO(template))
    context = {p.strip("{} "): v for p, v in values.items()}
    doc.render(context, jinja_env=SandboxedEnvironment(undefined=_Keep), autoescape=True)
    out = io.BytesIO()
    doc.save(out)
    return out.getvalue()


def evidence_of(p: Json, source: Json) -> list[Json]:
    """Where a placeholder's value comes from: the cited source of a field, every summed
    value of an aggregate, the documents counted; approval and reference cite no document."""
    kind = source["kind"]
    if kind == "field":
        return [r.evidence for d in docs_of(p, source["document_type"])
                if (r := read(d, source["field"])).evidence]  # fmt: skip
    if kind == "aggregate" and source.get("op") == "sum":
        top = (source.get("field") or "").split(".")[0]
        return [e for d in docs_of(p, source["document_type"]) if (e := cite(d, top))]
    if kind == "aggregate":
        return [whole(d) for d in docs_of(p, source["document_type"])]
    return []


def manifest_values(p: Json, placeholders: list[Json], filled: list[Json]) -> list[dict[str, Any]]:
    by_name = {f["placeholder"]: f["value"] for f in filled}
    return [
        {
            "placeholder": m["placeholder"],
            "value": by_name[m["placeholder"]],
            "source": m["source"],
            "evidence": evidence_of(p, m["source"]),
        }
        for m in placeholders
    ]
