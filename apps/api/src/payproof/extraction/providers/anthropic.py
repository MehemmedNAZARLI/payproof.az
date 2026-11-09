"""`AI_PROVIDER=anthropic`: Claude through the official Anthropic Python SDK.

PDFs go as a base64 `document` block (or as their text layer when pre-processing found one),
images as an `image` block; the answer is constrained with structured outputs
(`output_config.format` = the registry-derived JSON schema). Timeouts and retries are the SDK's
(`AI_TIMEOUT_SECONDS`, `AI_MAX_RETRIES`). Nothing here logs document content or the key."""

import base64
import json
import logging
from typing import Any

import anthropic

from payproof.core.settings import Settings
from payproof.extraction.generic import GenericData
from payproof.extraction.llm import (
    ExtractionUnavailable,
    LlmFile,
    normalize,
    response_schema,
    system_prompt,
)

log = logging.getLogger(__name__)
DEFAULT_MODEL = "claude-opus-5-5"  # platform.claude.com models overview, 2026-11
_IMAGES = {"image/png", "image/jpeg"}
_FALLBACK_BETA = "server-side-fallback-2026-07-01"


def _content(file: LlmFile) -> list[dict[str, Any]]:
    if file.text and any(p.strip() for p in file.text):
        numbered = enumerate(file.text, start=1)
        pages = "\n\n".join(f"<page number={i}>\n{t}\n</page>" for i, t in numbered)
        return [{"type": "text", "text": f"<document>\n{pages}\n</document>"}]
    data = base64.standard_b64encode(file.data).decode("ascii")
    source = {"type": "base64", "media_type": file.mime, "data": data}
    if file.mime == "application/pdf":
        return [{"type": "document", "source": source}]
    if file.mime in _IMAGES:
        return [{"type": "image", "source": source}]
    raise ExtractionUnavailable(f"unsupported input type {file.mime}")


class AnthropicExtractor:
    provider = "anthropic"

    def __init__(self, settings: Settings, client: Any | None = None) -> None:
        self.model = settings.ai_model or DEFAULT_MODEL
        self.min_confidence = settings.ai_min_confidence
        key = settings.ai_api_key.get_secret_value() if settings.ai_api_key else None
        # typed loosely: tests pass a stand-in; the request below is plain JSON-shaped dicts
        self._client: Any = client or anthropic.AsyncAnthropic(
            api_key=key,
            base_url=settings.ai_base_url or None,
            timeout=settings.ai_timeout_seconds,
            max_retries=settings.ai_max_retries,
        )

    async def extract(self, file: LlmFile, document_type: dict[str, Any]) -> GenericData:
        extraction = document_type["extraction"]
        schema = response_schema(extraction)
        ask = (f"Bu sənəddən '{document_type['name']}' sxeminin sahələrini çıxar. "
               f"Sənəd {file.pages} səhifədir; səhifələri 1-dən say.")  # fmt: skip
        content = [*_content(file), {"type": "text", "text": ask}]
        try:
            response = await self._client.beta.messages.create(
                model=self.model,
                max_tokens=16000,
                system=system_prompt(document_type),
                messages=[{"role": "user", "content": content}],
                output_config={"format": {"type": "json_schema", "schema": schema}},
                # a policy decline is re-run on a fallback model inside the same call
                betas=[_FALLBACK_BETA],
                fallbacks="default",
            )  # fmt: skip
        except anthropic.APIStatusError as e:  # 4xx/5xx after the SDK's retries
            log.warning("anthropic extraction failed: status=%s", e.status_code)
            raise ExtractionUnavailable(f"provider status {e.status_code}") from e
        except anthropic.APIConnectionError as e:  # includes timeouts
            log.warning("anthropic extraction failed: %s", type(e).__name__)
            raise ExtractionUnavailable(type(e).__name__) from e
        if response.stop_reason in ("refusal", "max_tokens"):
            raise ExtractionUnavailable(f"stop_reason={response.stop_reason}")
        text = next((b.text for b in response.content if b.type == "text"), None)
        try:
            raw = json.loads(text or "")
        except json.JSONDecodeError as e:
            raise ExtractionUnavailable("answer is not JSON") from e
        if not isinstance(raw, dict):
            raise ExtractionUnavailable("answer is not an object")
        return normalize(raw, extraction, file.pages, self.min_confidence)
