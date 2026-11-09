"""ADR-0011 demo configuration: the UNEC output template (fixtures/templates) as uploaded."""

from collections.abc import Sequence

from payproof.repositories.models import OutputTemplate
from payproof.repositories.orm import Base
from payproof.seed.fixtures import CUSTOMERS, FIXTURES, uid
from payproof.seed.identity import COMPANY_ID
from payproof.services.docx import placeholders

TEMPLATES = FIXTURES / "templates"


def template_key(customer: str, sha256: str) -> str:
    return f"templates/{uid(customer)}/{sha256}.docx"  # same key as an API upload


def config_rows() -> list[Sequence[Base]]:
    rows: list[Base] = []
    for c in CUSTOMERS.values():
        for rs in c["requirement_sets"]:
            if not (out := rs.get("output")):
                continue
            t = out["template"]
            data = (TEMPLATES / t["file_name"]).read_bytes()
            rows.append(OutputTemplate(
                id=uid(f"{c['id']}:template:{t['sha256'][:12]}"), company_id=COMPANY_ID,
                customer_id=uid(c["id"]), file_name=t["file_name"], sha256=t["sha256"],
                size=len(data), storage_key=template_key(c["id"], t["sha256"]),
                placeholders=placeholders(data), uploaded_by=uid(rs["approved_by"]),
            ))  # fmt: skip
    return [rows]
