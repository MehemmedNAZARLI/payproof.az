"""`AI_PROVIDER=openai`: placeholder behind the same interface. Configuration is validated at
startup like any provider, but extraction is not implemented yet: a job fails technically
(FAILED, retried first) — it never stores a value and never passes a check."""

from typing import Any

from payproof.core.settings import Settings
from payproof.extraction.generic import GenericData
from payproof.extraction.llm import ExtractionUnavailable, LlmFile


class OpenAIExtractor:
    provider = "openai"

    def __init__(self, settings: Settings) -> None:
        self.model = settings.ai_model or ""
        self.base_url = settings.ai_base_url

    async def extract(self, file: LlmFile, document_type: dict[str, Any]) -> GenericData:
        raise ExtractionUnavailable("AI_PROVIDER=openai is not implemented yet")
