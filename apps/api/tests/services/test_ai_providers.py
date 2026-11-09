"""AI provider adapters without the network: the Anthropic SDK client is a stand-in that records
the request and returns a canned answer."""

import json
import logging
from types import SimpleNamespace
from typing import Any

import anthropic
import httpx2
import pytest
from pydantic import SecretStr

from payproof.core.settings import Settings, get_settings
from payproof.extraction.llm import SECURITY_PREFIX, ExtractionUnavailable, LlmFile
from payproof.extraction.providers.anthropic import DEFAULT_MODEL, AnthropicExtractor
from payproof.extraction.providers.mock import MockLlmExtractor
from payproof.extraction.providers.openai import OpenAIExtractor
from payproof.extraction.providers.select import get_extractor
from payproof.seed.fixtures import FIXTURES

TYPES = {t["key"]: t for t in json.loads((FIXTURES / "config/document-types.json").read_text())}
RECEIPT = TYPES["receipt"]
PDF = LlmFile("qebz.pdf", b"%PDF-1.4 SECRET-DOCUMENT-TEXT", "application/pdf", 1)


class FakeMessages:
    def __init__(self, reply: Any) -> None:
        self.reply = reply
        self.calls: list[dict[str, Any]] = []

    async def create(self, **kw: Any) -> Any:
        self.calls.append(kw)
        if isinstance(self.reply, Exception):
            raise self.reply
        return self.reply


def fake(text: str = "{}", stop: str = "end_turn", model: str = DEFAULT_MODEL) -> Any:
    block = SimpleNamespace(type="text", text=text)
    msg = SimpleNamespace(stop_reason=stop, content=[block], model=model)
    return SimpleNamespace(beta=SimpleNamespace(messages=FakeMessages(msg)))


def settings(provider: str = "anthropic", **env: Any) -> Settings:
    key = SecretStr("sk-ant-test-key")
    update = {"ai_provider": provider, "ai_api_key": key, **env}
    return get_settings().model_copy(update=update)


def answer() -> str:
    def it(v: Any) -> dict[str, Any]:
        return {"value": v, "page": 1, "quote": f"«{v}»", "confidence": 0.99}

    fields = {f["key"]: it(None) for f in RECEIPT["extraction"]["fields"]}
    merchant = {"name": "Kitab Evi", "tax_id": None, "id_number": None}
    fields |= {"receipt_number": it("0412"), "total": it("12.50"), "currency": it("AZN")}
    fields["merchant"] = it(merchant)
    return json.dumps({"fields": fields, "tables": {"lines": []}})


async def test_request_shape_pdf_schema_prefix_and_default_model() -> None:
    client = fake(answer())
    g = await AnthropicExtractor(settings(), client).extract(PDF, RECEIPT)
    [kw] = client.beta.messages.calls
    assert kw["model"] == DEFAULT_MODEL == "claude-opus-5-5"
    assert kw["system"].startswith(SECURITY_PREFIX) and RECEIPT["instructions"] in kw["system"]
    doc = kw["messages"][0]["content"][0]
    assert doc["type"] == "document" and doc["source"]["media_type"] == "application/pdf"
    assert kw["output_config"]["format"]["type"] == "json_schema"
    assert kw["fallbacks"] == "default"
    assert g.fields["total"] == "12.50" and g.evidence["merchant"]["quote"].startswith("«")


async def test_model_override_text_layer_and_images() -> None:
    client = fake(answer())
    ex = AnthropicExtractor(settings(ai_model="claude-sonnet-5-5"), client)
    await ex.extract(
        LlmFile("a.pdf", b"%PDF", "application/pdf", 2, ("Qəbz 0412", "Cəmi")), RECEIPT
    )
    await ex.extract(LlmFile("a.png", b"\x89PNG", "image/png", 1), RECEIPT)
    first, second = client.beta.messages.calls
    assert first["model"] == "claude-sonnet-5-5"
    assert "<page number=2>" in first["messages"][0]["content"][0]["text"]
    assert second["messages"][0]["content"][0]["type"] == "image"


UNUSABLE = [("{}", "refusal"), ("{", "max_tokens"), ("not json", "end_turn"), ("[]", "end_turn")]


@pytest.mark.parametrize(("text", "stop"), UNUSABLE)
async def test_unusable_answers_are_errors_not_values(text: str, stop: str) -> None:
    with pytest.raises(ExtractionUnavailable):
        await AnthropicExtractor(settings(), fake(text, stop)).extract(PDF, RECEIPT)


async def test_provider_errors_are_logged_without_content_or_key(
    caplog: pytest.LogCaptureFixture,
) -> None:
    req = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
    error = anthropic.InternalServerError("boom", response=httpx2.Response(500, request=req),
                                          body=None)  # fmt: skip
    client = SimpleNamespace(beta=SimpleNamespace(messages=FakeMessages(error)))
    with caplog.at_level(logging.DEBUG), pytest.raises(ExtractionUnavailable, match="500"):
        await AnthropicExtractor(settings(), client).extract(PDF, RECEIPT)
    assert "SECRET-DOCUMENT-TEXT" not in caplog.text and "sk-ant-test-key" not in caplog.text


async def test_openai_stub_and_selection() -> None:
    openai = settings("openai")
    assert isinstance(get_extractor(openai), OpenAIExtractor)
    with pytest.raises(ExtractionUnavailable, match="not implemented"):
        await OpenAIExtractor(openai).extract(PDF, RECEIPT)
    assert isinstance(get_extractor(settings()), AnthropicExtractor)
    mock = get_extractor(settings("mock"))
    assert isinstance(mock, MockLlmExtractor) and mock.provider == "mock"


async def test_mock_reads_prepared_demo_documents_only() -> None:
    bank = {**TYPES["bank_statement"]}
    name = "bank_cixarisi_LH_2026-09_10.pdf"
    g = await MockLlmExtractor().extract(LlmFile(name, b"", "", 2), bank)
    assert g.fields["account_holder"]["id_number"] == "5ZK8M2P" and not g.unreadable
    unknown = await MockLlmExtractor().extract(LlmFile("x.pdf", b"", "", 1), bank)
    assert unknown.unreadable[:2] == ["bank_name", "account_holder"] and not unknown.evidence
    pdf = await MockLlmExtractor(prepared=False).extract(LlmFile(name, b"", "", 2), bank)
    assert "account_holder" in pdf.unreadable  # `pdf` does not read configured types


async def test_the_model_that_answered_is_recorded() -> None:
    ex = AnthropicExtractor(settings(), fake(answer(), model="claude-opus-5"))  # a fallback
    await ex.extract(PDF, RECEIPT)
    assert (ex.model, ex.served_model) == ("claude-opus-5-5", "claude-opus-5")
