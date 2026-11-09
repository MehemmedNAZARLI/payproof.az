"""Check families — document count, presence and equality (port of families-basic.ts)."""

from typing import Any

from payproof.domain.checks.values import (
    MONEY,
    Json,
    amount,
    currency_of,
    docs_of,
    js_str,
    na,
    read_all,
    verdict,
    whole,
)


def document_count(p: Json, rs: Json, names: dict[str, str]) -> Json:
    counts = {r["type"]: len(docs_of(p, r["type"])) for r in rs["documents"]}

    def out_of_range(r: Json) -> bool:
        n = counts.get(r["type"], 0)
        return n < r["min_count"] or (r["max_count"] is not None and n > r["max_count"])

    bad = [r for r in rs["documents"] if out_of_range(r)]
    evidence = [whole(d) for d in p["documents"] if d["type"] in counts]
    listed = ", ".join(f"{names[r['type']]} {counts[r['type']]}" for r in rs["documents"])
    if not bad:
        return verdict("PASS", f"Sənəd dəsti tamdır: {listed}.", evidence, {"counts": counts})

    def limit(r: Json) -> str:
        top = "∞" if r["max_count"] is None else r["max_count"]
        return f"{names[r['type']]} (tələb: {r['min_count']}–{top}, var: {counts[r['type']]})"

    what = "; ".join(limit(r) for r in bad)
    missing = [r["type"] for r in bad if counts.get(r["type"], 0) < r["min_count"]]
    return verdict("FAIL", f"Sənəd sayı tələbə uyğun deyil: {what}.", evidence,
                   {"counts": counts, "missing": missing})  # fmt: skip


def field_present(p: Json, params: Json, _: Any = None) -> Json:
    missing: list[Json] = []
    unreadable: list[Json] = []
    evidence: list[Json] = []
    for t in params["targets"]:
        for doc, r in read_all(p, t):
            at = {"document_id": doc["id"], "field": t["field"]}
            if r.status == "missing":
                missing.append(at)
                evidence.append(whole(doc))
            else:
                if r.status == "unreadable":
                    unreadable.append(at)
                if r.evidence:
                    evidence.append(r.evidence)
    if not evidence:
        return na("Yoxlanacaq sənəd yoxdur.")
    data = {"missing": missing, "unreadable": unreadable}
    if missing:
        return verdict("FAIL", f"{len(missing)} məcburi sahə sənəddə yoxdur.", evidence, data)
    if unreadable:
        msg = f"{len(unreadable)} sahə oxunmadı — mənbəyə əsasən düzəldin."
        return verdict("UNKNOWN", msg, evidence, data)
    msg = f"Bütün məcburi sahələr mənbə ilə çıxarılıb ({len(evidence)})."
    return verdict("PASS", msg, evidence, data)


def values_equal(p: Json, params: Json, names: dict[str, str]) -> Json:
    values: list[Json] = []
    evidence: list[Json] = []
    unknown = False
    for f in params["fields"]:
        for doc, r in read_all(p, f):
            if r.status == "ok":
                label = f"{names[f['document_type']]}: {f['field']}"
                values.append({"document_id": doc["id"], "field": label,
                               "value": js_str(r.value), "currency": currency_of(doc)})  # fmt: skip
                evidence.append(r.evidence)  # type: ignore[arg-type]
            else:
                unknown = True
                if r.status == "unreadable" and r.evidence:
                    evidence.append(r.evidence)
    if unknown:
        return verdict("UNKNOWN", "Müqayisə üçün dəyər oxunmayıb.", evidence, {"values": values})
    if len(values) < 2:
        return na("Müqayisə üçün ən azı iki dəyər lazımdır.")
    tol = amount(params.get("tolerance") or "0.00")
    is_money = all(MONEY.match(v["value"]) for v in values)
    casefold = params.get("normalize") == "casefold"

    def key(s: str) -> str:
        return s.strip().lower() if casefold else s

    first = values[0]["value"]
    # amounts are equal only in the same currency — never compared across AZN and USD
    if is_money and any(not v["currency"] for v in values):
        return verdict("UNKNOWN", "Məbləğin valyutası oxunmayıb.", evidence, {"values": values})
    if is_money and len({v["currency"] for v in values}) > 1:
        return verdict("FAIL", "Məbləğlər fərqli valyutadadır.", evidence, {"values": values})
    differs = any(
        abs(amount(v["value"]) - amount(first)) > tol if is_money else key(v["value"]) != key(first)
        for v in values
    )
    shown = " / ".join(dict.fromkeys(v["value"] for v in values))
    if differs:
        return verdict("FAIL", f"Dəyərlər fərqlidir: {shown}.", evidence, {"values": values})
    return verdict("PASS", f"Dəyərlər bütün sənədlərdə eynidir: {shown}.", evidence,
                   {"values": values})  # fmt: skip
