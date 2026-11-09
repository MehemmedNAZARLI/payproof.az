"""AI_PROVIDER → the one extraction interface (ADR-0011 §5). Provider modules (and their SDKs)
are imported only when selected."""

from payproof.core.settings import Settings
from payproof.extraction.llm import LlmExtractor


def get_extractor(settings: Settings) -> LlmExtractor:
    match settings.ai_provider:
        case "anthropic":
            from payproof.extraction.providers.anthropic import AnthropicExtractor

            return AnthropicExtractor(settings)
        case "openai":
            from payproof.extraction.providers.openai import OpenAIExtractor

            return OpenAIExtractor(settings)
        case _:  # mock; `pdf` reads only invoice text layers — configured types read as unread
            from payproof.extraction.providers.mock import MockLlmExtractor

            return MockLlmExtractor(prepared=settings.ai_provider == "mock")
