"""`AI_PROVIDER=mock` for configured document types: the prepared extraction of a demo document
(fixtures/scenarios, by file name) — labelled `mock`; any other file reads as nothing (every
key unread, a person reads it). No network, no key."""

import json
from functools import cache
from typing import Any

from payproof.extraction.generic import GenericData
from payproof.extraction.llm import LlmFile
from payproof.services.registry import CONFIG

_SCENARIOS = CONFIG.parent / "scenarios"


@cache
def _prepared() -> dict[tuple[str, str], dict[str, Any]]:
    docs = {}
    for path in sorted(_SCENARIOS.glob("*.json")):
        data = json.loads(path.read_text())
        packages = data.get("packages") if isinstance(data, dict) else None
        for p in packages if isinstance(packages, list) else []:  # scenario files only
            for d in p.get("documents", []):
                docs[(d["type"], d["file_name"])] = d
    return docs


class MockLlmExtractor:
    model = "mock"

    def __init__(self, prepared: bool = True) -> None:
        self.prepared = prepared  # False (`pdf`): configured types are not read at all
        self.provider = "mock" if prepared else "pdf"

    async def extract(self, file: LlmFile, document_type: dict[str, Any]) -> GenericData:
        d = _prepared().get((document_type["key"], file.file_name)) if self.prepared else None
        if d is not None:
            return GenericData(d["fields"], list(d["unreadable"]), d["tables"], d["evidence"])
        x = document_type["extraction"]
        keys = [f["key"] for f in x["fields"]]
        lists = [t["key"] for t in [*x.get("tables", []), *x.get("transaction_lists", [])]]
        return GenericData(dict.fromkeys(keys), keys + lists, {}, {})
