"""ADR-0011 view and validation of a requirement set's configuration (documents, checks, output).

A legacy set (flags only) is shown as its derived profile — the same as the mock's
`legacyProfile`; a configured set is validated against the registry, the check library and the
customer's uploaded template before it is stored."""

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.errors import InvalidInput
from payproof.domain.checks.config import ConfigError, validate_config
from payproof.domain.rules.catalog import TITLES
from payproof.repositories.models import RequirementSet
from payproof.schemas.auth import UserRef
from payproof.schemas.detail import RequirementSet as RsOut
from payproof.services import output_templates, registry

LEGACY_RULES = [f"R-00{i}" for i in range(1, 10)]


def legacy_profile(require_delivery: bool) -> dict[str, Any]:
    return {
        "documents": [
            {"type": "invoice", "min_count": 1, "max_count": 1},
            {"type": "order", "min_count": 0, "max_count": 1},
            {"type": "delivery", "min_count": 1 if require_delivery else 0, "max_count": 1},
        ],
        "checks": [
            {"id": r, "type": "legacy_rule", "title": TITLES[r], "parameters": {}}
            for r in LEGACY_RULES
        ],
        "output": None,
    }


def config_of(rs: RequirementSet, names: dict[str, str]) -> dict[str, Any]:
    """documents (with registry names), checks and output of a stored set."""
    config: dict[str, Any] = (
        {"documents": rs.documents or [], "checks": rs.checks, "output": rs.output}
        if rs.checks is not None
        else legacy_profile(rs.require_delivery)
    )
    documents: list[dict[str, Any]] = config["documents"]
    config["documents"] = [{**d, "name": names.get(d["type"], d["type"])} for d in documents]
    return config


async def validate(
    session: AsyncSession,
    customer_id: uuid.UUID,
    documents: list[dict[str, Any]],
    checks: list[dict[str, Any]],
    output: dict[str, Any] | None,
) -> None:
    template = None
    if output is not None:
        t = await output_templates.find(session, customer_id, output["template"]["sha256"])
        template = set(t.placeholders) if t else None
    types = {k: {"key": e.key, "extraction": e.extraction}
             for k, e in (await registry.current(session)).items()}  # fmt: skip
    try:
        validate_config(
            documents, checks, output,
            registry=types, library=registry.load_library(), template_placeholders=template,
        )  # fmt: skip
    except ConfigError as e:
        raise InvalidInput("Tələb dəstinin konfiqurasiyası yanlışdır.", {"fields": e.errors}) from e


async def type_names(session: AsyncSession) -> dict[str, str]:
    return {k: e.name for k, e in (await registry.current(session)).items()}


def requirement_set_out(rs: RequirementSet, approver: UserRef, names: dict[str, str]) -> RsOut:
    return RsOut(
        id=rs.id, version=rs.version, require_po=rs.require_po,
        require_delivery=rs.require_delivery, require_signature=rs.require_signature,
        tolerance=f"{rs.tolerance:.2f}", effective_from=rs.effective_from, approved_by=approver,
        reason=rs.reason, created_at=rs.created_at, **config_of(rs, names),
    )  # fmt: skip
