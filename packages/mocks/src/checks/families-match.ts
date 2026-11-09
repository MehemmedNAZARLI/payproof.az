// Check library family (ADR-0011) — document ↔ statement transaction matching.
import { cents } from "../money";
import { cite, daysBetween, docsOf, read, sameCounterparty, whole } from "./read";
import type { EvidenceRef, GenericDoc, GenericPkg, Verdict } from "./types";
import { fmt, money, NA, verdict } from "./verdict";

interface MatchParams {
  source: {
    document_type: string;
    amount_field: string;
    date_field: string;
    counterparty_field: string;
  };
  against: { document_type: string; list: string }[];
  amount_tolerance: string;
  date_window_days: number;
  counterparty: "normalized" | "ignore";
  direction: "debit" | "credit";
}
interface Txn {
  doc: GenericDoc;
  list: string;
  index: number;
  c: number;
  date: string;
  counterparty: string;
}
const at = (t: Txn) => ({ document_id: t.doc.id, index: t.index });
const citeTxn = (t: Txn) => cite(t.doc, `${t.list}[${t.index}]`) ?? whole(t.doc);

/**
 * Every source document must pair with exactly one transaction (amount within tolerance, date in
 * [doc date, doc date + window], same counterparty). Unique pairs are fixed first, repeatedly, so the
 * result does not depend on document order; what stays ambiguous is UNKNOWN — a person picks.
 */
export function transactionMatch(p: GenericPkg, params: MatchParams): Verdict {
  const txns: Txn[] = params.against.flatMap((a) =>
    docsOf(p, a.document_type).flatMap((doc) =>
      (doc.tables[a.list] ?? []).flatMap((row, index) =>
        row.direction === params.direction && typeof row.amount === "string"
          ? [
              {
                doc,
                list: a.list,
                index,
                c: cents(row.amount),
                date: String(row.date),
                counterparty: String(row.counterparty),
              },
            ]
          : [],
      ),
    ),
  );
  const { source: s } = params;
  const sources = docsOf(p, s.document_type).map((doc) => {
    const r = [s.amount_field, s.date_field, s.counterparty_field].map((f) => read(doc, f));
    const ok = r.every((x) => x.status === "ok");
    const [amount, date, cp] = r.map((x) => (x.status === "ok" ? String(x.value) : ""));
    return {
      doc,
      ok,
      c: ok ? cents(amount!) : 0,
      date: date!,
      cp: cp!,
      evidence: cite(doc, s.amount_field) ?? whole(doc),
    };
  });
  if (!sources.length) return NA("Tutuşdurulacaq sənəd yoxdur.");
  const tol = cents(params.amount_tolerance);
  const fits = (src: (typeof sources)[number], t: Txn) =>
    Math.abs(t.c - src.c) <= tol &&
    daysBetween(src.date, t.date) >= 0 &&
    daysBetween(src.date, t.date) <= params.date_window_days &&
    (params.counterparty === "ignore" || sameCounterparty(src.cp, t.counterparty));

  const paired = new Map<string, Txn>();
  const used = new Set<Txn>();
  for (let changed = true; changed;) {
    changed = false;
    const open = sources.filter((x) => x.ok && !paired.has(x.doc.id));
    const only = open.map((src) => {
      const options = txns.filter((t) => !used.has(t) && fits(src, t));
      return options.length === 1 ? options[0]! : null;
    });
    open.forEach((src, i) => {
      const t = only[i];
      // a transaction that is the only option of two documents is contested: nobody gets it
      if (!t || only.filter((x) => x === t).length > 1) return;
      paired.set(src.doc.id, t);
      used.add(t);
      changed = true;
    });
  }
  const evidence: EvidenceRef[] = [];
  const matches: unknown[] = [];
  const unmatched: Record<string, unknown>[] = [];
  const ambiguous: string[] = [];
  const unreadable: string[] = [];
  const cur = (d: GenericDoc) => String(d.fields.currency ?? p.currency);
  for (const src of sources) {
    evidence.push(src.evidence);
    const t = paired.get(src.doc.id);
    if (t) {
      matches.push({ document_id: src.doc.id, transaction: at(t) });
      evidence.push(citeTxn(t));
    } else if (!src.ok) unreadable.push(src.doc.id);
    else if (txns.some((x) => !used.has(x) && fits(src, x))) ambiguous.push(src.doc.id);
    else {
      const near = txns
        .filter(
          (x) =>
            !used.has(x) &&
            (params.counterparty === "ignore" || sameCounterparty(src.cp, x.counterparty)),
        )
        .sort(
          (a, b) => Math.abs(a.c - src.c) - Math.abs(b.c - src.c) || a.date.localeCompare(b.date),
        )[0];
      const c = cur(src.doc);
      unmatched.push({
        document_id: src.doc.id,
        amount: money(src.c, c),
        nearest: near
          ? { ...at(near), amount: money(near.c, c), difference: money(src.c - near.c, c) }
          : null,
      });
      if (near) evidence.push(citeTxn(near));
    }
  }
  const data = { matches, unmatched, ambiguous, unreadable };
  if (unmatched.length) {
    const what = unmatched
      .map((u) => {
        const src = sources.find((x) => x.doc.id === u.document_id)!;
        const n = u.nearest as {
          amount: { amount: string };
          difference: { amount: string };
        } | null;
        const c = cur(src.doc);
        return `${src.doc.file_name} (${fmt(src.c, c)}): uyğun əməliyyat yoxdur${n ? `; ən yaxın ${n.amount.amount} ${c}, fərq ${n.difference.amount} ${c}` : ""}`;
      })
      .join(" · ");
    return verdict("FAIL", what, evidence, data);
  }
  if (ambiguous.length || unreadable.length)
    return verdict(
      "UNKNOWN",
      `${ambiguous.length + unreadable.length} sənəd üçün əməliyyat birmənalı seçilmədi — insan təsdiqi lazımdır.`,
      evidence,
      data,
    );
  return verdict(
    "PASS",
    `${matches.length} sənədin hər biri bir ödəniş əməliyyatı ilə tutuşur.`,
    evidence,
    data,
  );
}
