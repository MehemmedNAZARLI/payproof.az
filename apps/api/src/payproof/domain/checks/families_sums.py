"""Check families — line totals, date periods and spending limits (port of families-sums.ts)."""

from decimal import Decimal
from typing import Any

from payproof.domain.checks.values import (
    Json,
    amount,
    cite,
    currency_of,
    docs_of,
    fmt,
    js_str,
    money,
    na,
    read,
    read_all,
    verdict,
    whole,
)


def totals_sum(p: Json, params: Json, _: Any = None) -> Json:
    evidence: list[Json] = []
    documents: list[Json] = []
    unknown = False
    bad: list[str] = []
    docs = docs_of(p, params["document_type"])
    if not docs:
        return na("Yoxlanacaq sənəd yoxdur.")
    for d in docs:
        cur = currency_of(d)
        total = read(d, params["total_field"])
        rows = d["tables"].get(params["table"]) or []
        evidence += [cite(d, f"{params['table']}[{i}]") or whole(d) for i in range(len(rows))]
        amounts = [r.get(params["amount_column"]) for r in rows]
        unread = total.status != "ok" or not rows or not cur
        if (
            unread
            or cur is None
            or total.evidence is None
            or any(not isinstance(a, str) for a in amounts)
        ):
            unknown = True
            ok = total.status == "ok" and total.evidence is not None
            evidence.append(total.evidence if ok and total.evidence else whole(d))
            continue
        evidence.append(total.evidence)
        lines = sum((amount(a) for a in amounts), Decimal("0.00"))
        diff = lines - amount(js_str(total.value))
        documents.append(
            {
                "document_id": d["id"],
                "lines_total": money(lines, cur),
                "total": money(lines - diff, cur),
                "difference": money(diff, cur),
            }
        )
        if abs(diff) > amount(params["tolerance"]):
            bad.append(f"{d['file_name']}: {fmt(diff, cur)}")
    if bad:
        msg = f"Sətir cəmi yekundan fərqlidir — {'; '.join(bad)}."
        return verdict("FAIL", msg, evidence, {"documents": documents})
    if unknown:
        msg = "Sətir və ya yekun məbləğ oxunmayıb."
        return verdict("UNKNOWN", msg, evidence, {"documents": documents})
    msg = f"Sətirlərin cəmi {len(documents)} sənəddə yekuna bərabərdir."
    return verdict("PASS", msg, evidence, {"documents": documents})


def date_within_period(p: Json, params: Json, _: Any = None) -> Json:
    evidence: list[Json] = []

    def bound(b: Any) -> str | None:
        if isinstance(b, str):
            return b
        # a bound must be unambiguous: one document of its type, or the result depends on order
        docs = docs_of(p, b["document_type"])
        r = read(docs[0], b["field"]) if len(docs) == 1 else None
        if r is None or r.status != "ok":
            return None
        evidence.append(r.evidence)  # type: ignore[arg-type]
        return js_str(r.value)

    start = bound(params["period"]["from"])
    end = bound(params["period"]["to"])
    dates = read_all(p, params["target"])
    evidence += [r.evidence for _, r in dates if r.status == "ok"]  # type: ignore[misc]
    if not dates:
        return na("Yoxlanacaq sənəd yoxdur.")
    if not start or not end or any(r.status != "ok" for _, r in dates):
        return verdict("UNKNOWN", "Tarix və ya dövr sərhədi oxunmayıb.", evidence,
                       {"from": start, "to": end})  # fmt: skip
    outside = [
        {"document_id": d["id"], "date": js_str(r.value)}
        for d, r in dates
        if not start <= js_str(r.value) <= end
    ]
    data = {"from": start, "to": end, "outside": outside}
    if outside:
        listed = ", ".join(x["date"] for x in outside)
        msg = f"{len(outside)} tarix {start} – {end} dövründən kənardır: {listed}."
        return verdict("FAIL", msg, evidence, data)
    return verdict("PASS", f"Bütün tarixlər {start} – {end} dövrü daxilindədir.", evidence, data)


def amount_within_limit(p: Json, params: Json, _: Any = None) -> Json:
    currency = params["limit"]["currency"]
    limit = amount(params["limit"]["amount"])
    values = read_all(p, params["target"])
    if not values:
        return na("Yoxlanacaq sənəd yoxdur.")
    evidence = [r.evidence for _, r in values if r.status != "missing" and r.evidence]
    if any(r.status != "ok" for _, r in values):
        return verdict("UNKNOWN", "Məbləğ oxunmayıb.", evidence, {})
    if any(currency_of(d) != currency for d, _ in values):
        msg = f"Limit {currency}-dədir; fərqli valyutalı məbləğ çevrilmir."
        return verdict("UNKNOWN", msg, evidence, {})
    amounts = [(d, amount(js_str(r.value))) for d, r in values]
    if params["aggregate"] == "sum":
        total = sum((a for _, a in amounts), Decimal("0.00"))
        data = {"total": money(total, currency), "limit": params["limit"]}
        if total > limit:
            over = f"{fmt(total - limit, currency)}"
            msg = f"Cəmi {fmt(total, currency)} limiti ({fmt(limit, currency)}) {over} aşır."
            return verdict("FAIL", msg, evidence, data)
        msg = f"Cəmi {fmt(total, currency)} limit ({fmt(limit, currency)}) daxilindədir."
        return verdict("PASS", msg, evidence, data)
    over_list = [
        {"document_id": d["id"], "amount": money(a, currency)} for d, a in amounts if a > limit
    ]
    if over_list:
        msg = f"{len(over_list)} məbləğ limitdən ({fmt(limit, currency)}) çoxdur."
        return verdict("FAIL", msg, evidence, {"over": over_list})
    msg = f"Hər məbləğ limit ({fmt(limit, currency)}) daxilindədir."
    return verdict("PASS", msg, evidence, {"over": over_list})
