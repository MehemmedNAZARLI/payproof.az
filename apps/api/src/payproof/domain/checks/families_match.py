"""Check family — document ↔ statement transaction matching (port of families-match.ts)."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from payproof.domain.checks.values import (
    Json,
    amount,
    cite,
    currency_of,
    days_between,
    docs_of,
    fmt,
    js_str,
    money,
    na,
    read,
    same_counterparty,
    verdict,
    whole,
)


@dataclass(frozen=True, eq=False)  # identity: two equal rows are two transactions
class Txn:
    doc: Json
    list: str
    index: int
    c: Decimal
    date: str
    counterparty: str
    currency: str


DIRECTIONS = ("debit", "credit")


@dataclass(frozen=True, eq=False)
class Src:
    doc: Json
    ok: bool
    c: Decimal
    date: str
    cp: str
    currency: str
    evidence: list[Json]


def _at(t: Txn) -> Json:
    return {"document_id": t.doc["id"], "index": t.index}


def _cite(t: Txn) -> Json:
    return cite(t.doc, f"{t.list}[{t.index}]") or whole(t.doc)


def _unread_rows(p: Json, against: list[Json]) -> list[Json]:
    """Statements or rows that were not read could hold the payment."""
    out: list[Json] = []
    for a in against:
        for doc in docs_of(p, a["document_type"]):
            # a statement without a read currency cannot pay anything in a known currency
            if a["list"] in doc["unreadable"] or not currency_of(doc):
                out.append(whole(doc))
                continue
            for i, row in enumerate(doc["tables"].get(a["list"]) or []):
                direction = js_str(row.get("direction", "undefined"))
                unread = not isinstance(row.get("amount"), str) or not isinstance(
                    row.get("date"), str
                )
                if unread or direction not in DIRECTIONS:
                    out.append(cite(doc, f"{a['list']}[{i}]") or whole(doc))
    return out


def _txns(p: Json, params: Json) -> list[Txn]:
    return [
        Txn(
            doc,
            a["list"],
            i,
            amount(row["amount"]),
            js_str(row.get("date", "undefined")),
            js_str(row.get("counterparty", "undefined")),
            currency_of(doc) or "",
        )
        for a in params["against"]
        for doc in docs_of(p, a["document_type"])
        for i, row in enumerate(
            [] if a["list"] in doc["unreadable"] else doc["tables"].get(a["list"]) or []
        )
        if row.get("direction") == params["direction"] and isinstance(row.get("amount"), str)
    ]


def _sources(p: Json, s: Json) -> list[Src]:
    fields = [s["amount_field"], s["date_field"], s["counterparty_field"]]
    out = []
    for doc in docs_of(p, s["document_type"]):
        reads = [read(doc, f) for f in fields]
        currency = currency_of(doc)
        ok = all(r.status == "ok" for r in reads) and currency is not None
        amt, date, cp = (js_str(r.value) if r.status == "ok" else "" for r in reads)
        evidence = [cite(doc, f.split(".")[0]) or whole(doc) for f in fields]
        c = amount(amt) if ok else Decimal("0.00")
        out.append(Src(doc, ok, c, date, cp, currency or "", evidence))
    return out


def _pair(sources: list[Src], txns: list[Txn], fits: Any) -> tuple[dict[str, Txn], set[int]]:
    """Unique pairs first, repeatedly, so the result does not depend on document order; a
    transaction that is the only option of two documents is contested — nobody gets it."""
    paired: dict[str, Txn] = {}
    used: set[int] = set()
    changed = True
    while changed:
        changed = False
        open_ = [x for x in sources if x.ok and x.doc["id"] not in paired]
        only: list[Txn | None] = []
        for src in open_:
            options = [t for t in txns if id(t) not in used and fits(src, t)]
            only.append(options[0] if len(options) == 1 else None)
        for src, t in zip(open_, only, strict=True):
            if t is None or sum(1 for x in only if x is t) > 1:
                continue
            paired[src.doc["id"]] = t
            used.add(id(t))
            changed = True
    return paired, used


def transaction_match(p: Json, params: Json, _: Any = None) -> Json:
    """Every source document must pair with exactly one transaction (amount within tolerance,
    date in [doc date, doc date + window], same counterparty); what stays ambiguous is UNKNOWN."""
    unread_rows = _unread_rows(p, params["against"])
    txns = _txns(p, params)
    sources = _sources(p, params["source"])
    if not sources:
        return na("Tutuşdurulacaq sənəd yoxdur.")
    tol = amount(params["amount_tolerance"])
    window = params["date_window_days"]
    ignore = params["counterparty"] == "ignore"

    def fits(src: Src, t: Txn) -> bool:
        # AZN and USD are never compared: a transaction pays a document only in its own currency
        days = days_between(src.date, t.date)
        return (t.currency == src.currency and abs(t.c - src.c) <= tol
                and days is not None and 0 <= days <= window
                and (ignore or same_counterparty(src.cp, t.counterparty)))  # fmt: skip

    paired, used = _pair(sources, txns, fits)
    evidence: list[Json] = []
    matches: list[Json] = []
    unmatched: list[Json] = []
    ambiguous: list[str] = []
    unreadable: list[str] = []
    messages: list[str] = []
    for src in sources:
        evidence += src.evidence
        cur = currency_of(src.doc) or "?"
        if t := paired.get(src.doc["id"]):
            matches.append({"document_id": src.doc["id"], "transaction": _at(t)})
            evidence.append(_cite(t))
        elif not src.ok or unread_rows:
            unreadable.append(src.doc["id"])
            evidence += unread_rows
        elif any(id(x) not in used and fits(src, x) for x in txns):
            ambiguous.append(src.doc["id"])
        else:
            candidates = [x for x in txns if id(x) not in used and x.currency == src.currency
                          and (ignore or same_counterparty(src.cp, x.counterparty))]  # fmt: skip
            near = min(candidates, key=lambda x: (abs(x.c - src.c), x.date), default=None)
            nearest = None
            if near:
                nearest = {**_at(near), "amount": money(near.c, cur),
                           "difference": money(src.c - near.c, cur)}  # fmt: skip
            unmatched.append({"document_id": src.doc["id"], "amount": money(src.c, cur),
                              "nearest": nearest})  # fmt: skip
            hint = ""
            if nearest:
                diff = nearest["difference"]["amount"]
                hint = f"; ən yaxın {nearest['amount']['amount']} {cur}, fərq {diff} {cur}"
            messages.append(
                f"{src.doc['file_name']} ({fmt(src.c, cur)}): uyğun əməliyyat yoxdur{hint}"
            )
            if near:
                evidence.append(_cite(near))
    data = {"matches": matches, "unmatched": unmatched, "ambiguous": ambiguous,
            "unreadable": unreadable}  # fmt: skip
    if unmatched:
        return verdict("FAIL", " · ".join(messages), evidence, data)
    if ambiguous or unreadable:
        n = len(ambiguous) + len(unreadable)
        msg = f"{n} sənəd üçün əməliyyat birmənalı seçilmədi — insan təsdiqi lazımdır."
        return verdict("UNKNOWN", msg, evidence, data)
    msg = f"{len(matches)} sənədin hər biri bir ödəniş əməliyyatı ilə tutuşur."
    return verdict("PASS", msg, evidence, data)
