"""Check families — duplicate use, party identity, line items (port of families-parties.ts)."""

from typing import Any

from payproof.domain.checks.values import (
    MONEY,
    Json,
    amount,
    cite,
    docs_of,
    js_str,
    na,
    normalize_name,
    read,
    read_all,
    verdict,
    whole,
)


def no_duplicate_use(p: Json, params: Json, others_all: list[Json]) -> Json:
    evidence: list[Json] = []
    duplicates: list[Json] = []
    unknown = False

    def key_of(d: Json, fields: list[str]) -> str | None:
        reads = [read(d, f) for f in fields]
        if all(r.status == "ok" for r in reads):
            return " · ".join(js_str(r.value) for r in reads)
        return None

    others = (
        [o for o in others_all if o["customer_id"] == p["customer_id"] and o["id"] != p["id"]]
        if params["scope"] == "customer"
        else []
    )
    for s in params["subjects"]:
        seen: dict[str, str] = {}
        for o in others:
            for d in docs_of(o, s["document_type"]):
                if k := key_of(d, s["key_fields"]):
                    seen[k] = o["reference"]
        for d in docs_of(p, s["document_type"]):
            k = key_of(d, s["key_fields"])
            evidence += [cite(d, f.split(".")[0]) or whole(d) for f in s["key_fields"]]
            if k is None:
                unknown = True
            elif k in seen:
                duplicates.append({"document_id": d["id"], "key": k, "package": seen[k]})
            else:
                seen[k] = p["reference"]
    if not evidence:
        return na("Yoxlanacaq sənəd yoxdur.")
    unique = list({f"{e['document_id']}:{e['field']}": e for e in evidence}.values())
    if duplicates:
        what = ", ".join(f"{x['key']} ({x['package']})" for x in duplicates)
        msg = f"Sənəd artıq istifadə olunub: {what}."
        return verdict("FAIL", msg, unique, {"duplicates": duplicates})
    if unknown:
        msg = "Təkrar yoxlaması üçün açar sahə oxunmayıb."
        return verdict("UNKNOWN", msg, unique, {"duplicates": duplicates})
    return verdict(
        "PASS", "Təkrar istifadə olunan sənəd yoxdur.", unique, {"duplicates": duplicates}
    )


def party_identity_match(p: Json, params: Json, _: Any = None) -> Json:
    reads = [x for ref in params["parties"] for x in read_all(p, ref)]
    evidence = [r.evidence for _, r in reads if r.status != "missing" and r.evidence]
    if len(reads) < 2:
        return na("Müqayisə üçün ən azı iki tərəf lazımdır.")
    parties = [r.value if r.status == "ok" else None for _, r in reads]

    def has(x: Any, k: str) -> bool:
        return isinstance(x, dict) and bool(x.get(k))

    key = next((k for k in params["match_on"] if all(has(x, k) for x in parties)), None)
    if key is None:
        msg = "Tərəfləri müqayisə etmək üçün ortaq identifikator yoxdur."
        return verdict("UNKNOWN", msg, evidence, {})
    values = [x[key] for x in parties]  # type: ignore[index]

    def norm(v: Any) -> str:
        return normalize_name(js_str(v)) if key == "name" else js_str(v).strip().upper()

    data = {"matched_on": key, "values": values}
    if len({norm(v) for v in values}) > 1:
        shown = " / ".join(js_str(v) for v in dict.fromkeys(values))
        return verdict("FAIL", f"Tərəflər fərqlidir ({key}): {shown}.", evidence, data)
    msg = f"Bütün sənədlər eyni tərəfə aiddir ({key}: {js_str(values[0])})."
    return verdict("PASS", msg, evidence, data)


def line_items_match(p: Json, params: Json, _: Any = None) -> Json:
    tol = amount(params.get("tolerance") or "0.00")
    sides = [docs_of(p, s["document_type"]) for s in (params["left"], params["right"])]
    if any(not docs for docs in sides):
        return na("Müqayisə üçün sənəd yoxdur.")

    def rows(side: Json, docs: list[Json]) -> list[tuple[Json, Json]]:
        t = side["table"]
        return [(row, cite(d, f"{t}[{i}]") or whole(d))
                for d in docs for i, row in enumerate(d["tables"].get(t) or [])]  # fmt: skip

    left, right = rows(params["left"], sides[0]), rows(params["right"], sides[1])
    missing: list[str] = []
    # an empty or unread table is not "nothing to compare" — it is unread data
    blank = [
        d
        for s, docs in zip((params["left"], params["right"]), sides, strict=True)
        for d in docs
        if not d["tables"].get(s["table"]) or s["table"] in d["unreadable"]
    ]
    if blank:
        return verdict("UNKNOWN", "Sətir cədvəli oxunmayıb.", [whole(d) for d in blank],
                       {"missing": missing, "differences": []})  # fmt: skip
    evidence: list[Json] = []
    differences: list[Json] = []
    key_col = params["key_column"]
    for row, ev in left:
        if row.get(key_col) is None:
            missing.append("—")
            evidence.append(ev)
            continue
        k = js_str(row[key_col])
        match = next((x for x in right if js_str(x[0].get(key_col, "undefined")) == k), None)
        evidence.append(ev)
        if match is None:
            missing.append(k)
            continue
        evidence.append(match[1])
        for c in params["compare"]:
            if row.get(c) is None or match[0].get(c) is None:
                missing.append(f"{k} {c}")
                continue
            a, b = js_str(row[c]), js_str(match[0][c])
            both = MONEY.match(a) and MONEY.match(b)
            same = abs(amount(a) - amount(b)) <= tol if both else a == b
            if not same:
                differences.append({"key": k, "column": c, "left": a, "right": b})
    data = {"missing": missing, "differences": differences}
    if differences:
        what = "; ".join(
            f"{x['key']} {x['column']}: {x['left']} ≠ {x['right']}" for x in differences
        )
        return verdict("FAIL", f"Sətir fərqi — {what}.", evidence, data)
    if missing:
        msg = f"Tutuşdurulmayan və ya oxunmayan sətir: {', '.join(missing)}."
        return verdict("UNKNOWN", msg, evidence, data)
    return verdict("PASS", f"{len(left)} sətir tutuşur.", evidence, data)
