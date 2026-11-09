import copy
import io
import zipfile
from collections.abc import Callable
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.seed.config import TEMPLATES
from payproof.seed.fixtures import CUSTOMERS, uid
from tests.api.test_contract import assert_matches

Auth = Callable[[str], dict[str, str]]
C3 = uid("c3")
UNEC = CUSTOMERS["c3"]["requirement_sets"][0]
TEMPLATE = (TEMPLATES / "UNEC_qrant_xerc_akti.docx").read_bytes()


def docx(*texts: str) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        body = "".join(f"<w:p><w:r><w:t>{t}</w:t></w:r></w:p>" for t in texts)
        z.writestr("word/document.xml", f"<w:document><w:body>{body}</w:body></w:document>")
    return buf.getvalue()


def rules(**over: Any) -> dict[str, Any]:
    body = {k: copy.deepcopy(UNEC[k]) for k in ("documents", "checks", "output")}
    flags = {"require_po": False, "require_delivery": False, "require_signature": False}
    reason = "UNEC qrant hesabatı: limit 1600 AZN-ə qaldırıldı."
    meta = {"tolerance": "0.00", "effective_from": "2026-12-01", "expected_version": 1}
    return {**flags, **meta, "reason": reason, **body, **over}


async def test_registry_and_library(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    types = (await client.get("/v1/document-types", headers=auth("u5"))).json()["items"]
    assert [t["key"] for t in types][:3] == ["invoice", "order", "delivery"]
    assert "instructions" not in types[0]
    for t in types:
        assert_matches("DocumentTypeInfo", t)
    library = (await client.get("/v1/check-library", headers=auth("u5"))).json()
    assert_matches("CheckLibrary", library)
    assert len(library["families"]) == 10


async def test_customers_show_configured_and_legacy_sets(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    items = (await client.get("/v1/customers", headers=auth("u5"))).json()["items"]
    sets = {c["external_id"]: c["current_requirements"] for c in items}
    assert [d["name"] for d in sets["UNEC-QRANT"]["documents"]] == [
        "Faktura", "Bank çıxarışı", "Kart çıxarışı"]  # fmt: skip
    assert sets["UNEC-QRANT"]["output"] == UNEC["output"]
    legacy = sets["CRQ-014"]
    assert [c["type"] for c in legacy["checks"]] == ["legacy_rule"] * 9
    assert legacy["documents"][2] == {"type": "delivery", "name": "Təhvil-təslim aktı",
                                      "min_count": 1, "max_count": 1}  # fmt: skip
    assert legacy["output"] is None


async def test_template_upload(client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth) -> None:
    url = f"/v1/customers/{C3}/output-templates"

    def send(user: str, name: str, data: bytes) -> Any:
        return client.post(url, headers=auth(user), files={"file": (name, data)})

    assert (await send("u1", "a.docx", TEMPLATE)).status_code == 403
    assert (await send("u2", "a.docx", b"%PDF-1.4")).status_code == 415
    assert (await send("u2", "a.docx", docx("Heç nə"))).status_code == 422
    r = await send("u2", "akt.docx", docx("Ad: {{name}}", "{{name}} / {{ total }}"))
    assert r.status_code == 201, r.text
    assert_matches("OutputTemplate", r.json())
    assert r.json()["placeholders"] == ["{{name}}", "{{total}}"]
    again = await send("u2", "akt.docx", docx("Ad: {{name}}", "{{name}} / {{ total }}"))
    assert again.json()["id"] == r.json()["id"]  # same content: stored once
    other = f"/v1/customers/{uid('nope')}/output-templates"
    assert (await client.post(other, headers=auth("u2"), files={"file": ("a.docx", TEMPLATE)})
            ).status_code == 404  # fmt: skip


async def test_configured_set_is_validated_and_versioned(
    client: httpx.AsyncClient, seeded: AsyncSession, auth: Auth
) -> None:
    url = f"/v1/customers/{C3}/requirements"
    bad = rules()
    bad["checks"][5]["parameters"]["limit"]["amount"] = "1600"
    r = await client.post(url, headers=auth("u2"), json=bad)
    assert r.status_code == 422
    assert r.json()["error"]["details"]["fields"] == {
        "checks[5].parameters.limit": "yanlış dəyər (money)"}  # fmt: skip
    half = rules()
    del half["checks"]
    assert (await client.post(url, headers=auth("u2"), json=half)).status_code == 422
    good = rules()
    good["checks"][5]["parameters"]["limit"]["amount"] = "1600.00"
    created = await client.post(url, headers=auth("u2"), json=good)
    assert created.status_code == 201, created.text
    assert_matches("RequirementSet", created.json())
    assert created.json()["checks"][5]["parameters"]["limit"] == {"amount": "1600.00",
                                                                  "currency": "AZN"}  # fmt: skip
    same = await client.post(url, headers=auth("u2"), json={**good, "expected_version": 2})
    assert same.status_code == 422  # nothing changed
