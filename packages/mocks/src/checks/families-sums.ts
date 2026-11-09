// Check library families (ADR-0011) — line totals, date periods and spending limits. Integer cents, no AI.
import { cents } from "../money";
import { cite, docsOf, read, readAll, whole } from "./read";
import type { EvidenceRef, FieldRef, GenericPkg, Verdict } from "./types";
import { fmt, money, NA, verdict } from "./verdict";

export function totalsSum(
  p: GenericPkg,
  params: {
    document_type: string;
    table: string;
    amount_column: string;
    total_field: string;
    tolerance: string;
  },
): Verdict {
  const evidence: EvidenceRef[] = [];
  const documents: Record<string, unknown>[] = [];
  let unknown = false;
  const bad: string[] = [];
  for (const d of docsOf(p, params.document_type)) {
    const cur = String(d.fields.currency ?? p.currency);
    const total = read(d, params.total_field);
    const rows = d.tables[params.table] ?? [];
    rows.forEach((_, i) => evidence.push(cite(d, `${params.table}[${i}]`) ?? whole(d)));
    const amounts = rows.map((r) => r[params.amount_column]);
    if (total.status !== "ok" || !rows.length || amounts.some((a) => typeof a !== "string")) {
      unknown = true;
      continue;
    }
    evidence.push(total.evidence);
    const sum = amounts.reduce<number>((s, a) => s + cents(a as string), 0);
    const diff = sum - cents(String(total.value));
    documents.push({
      document_id: d.id,
      lines_total: money(sum, cur),
      total: money(sum - diff, cur),
      difference: money(diff, cur),
    });
    if (Math.abs(diff) > cents(params.tolerance)) bad.push(`${d.file_name}: ${fmt(diff, cur)}`);
  }
  if (!evidence.length) return NA("Yoxlanacaq sənəd yoxdur.");
  if (bad.length)
    return verdict("FAIL", `Sətir cəmi yekundan fərqlidir — ${bad.join("; ")}.`, evidence, {
      documents,
    });
  if (unknown)
    return verdict("UNKNOWN", "Sətir və ya yekun məbləğ oxunmayıb.", evidence, { documents });
  return verdict(
    "PASS",
    `Sətirlərin cəmi ${documents.length} sənəddə yekuna bərabərdir.`,
    evidence,
    { documents },
  );
}

type Bound = string | FieldRef;
export function dateWithinPeriod(
  p: GenericPkg,
  params: { target: FieldRef; period: { from: Bound; to: Bound } },
): Verdict {
  const evidence: EvidenceRef[] = [];
  const bound = (b: Bound): string | null => {
    if (typeof b === "string") return b;
    const d = docsOf(p, b.document_type)[0];
    const r = d ? read(d, b.field) : null;
    if (r?.status !== "ok") return null;
    evidence.push(r.evidence);
    return String(r.value);
  };
  const from = bound(params.period.from);
  const to = bound(params.period.to);
  const dates = readAll(p, params.target);
  for (const { r } of dates) if (r.status === "ok") evidence.push(r.evidence);
  if (!dates.length) return NA("Yoxlanacaq sənəd yoxdur.");
  if (!from || !to || dates.some(({ r }) => r.status !== "ok"))
    return verdict("UNKNOWN", "Tarix və ya dövr sərhədi oxunmayıb.", evidence, { from, to });
  const outside = dates
    .map(({ doc, r }) => ({ document_id: doc.id, date: String((r as { value: unknown }).value) }))
    .filter((x) => x.date < from || x.date > to);
  const data = { from, to, outside };
  if (outside.length)
    return verdict(
      "FAIL",
      `${outside.length} tarix ${from} – ${to} dövründən kənardır: ${outside.map((x) => x.date).join(", ")}.`,
      evidence,
      data,
    );
  return verdict("PASS", `Bütün tarixlər ${from} – ${to} dövrü daxilindədir.`, evidence, data);
}

export function amountWithinLimit(
  p: GenericPkg,
  params: {
    target: FieldRef;
    aggregate: "each" | "sum";
    limit: { amount: string; currency: string };
  },
): Verdict {
  const { currency } = params.limit;
  const limit = cents(params.limit.amount);
  const values = readAll(p, params.target);
  if (!values.length) return NA("Yoxlanacaq sənəd yoxdur.");
  const evidence: EvidenceRef[] = values.flatMap(({ r }) =>
    r.status === "missing" ? [] : r.evidence ? [r.evidence] : [],
  );
  if (values.some(({ r }) => r.status !== "ok"))
    return verdict("UNKNOWN", "Məbləğ oxunmayıb.", evidence, {});
  if (values.some(({ doc }) => (doc.fields.currency ?? p.currency) !== currency))
    return verdict(
      "UNKNOWN",
      `Limit ${currency}-dədir; fərqli valyutalı məbləğ çevrilmir.`,
      evidence,
      {},
    );
  const amounts = values.map(({ doc, r }) => ({
    doc,
    c: cents(String((r as { value: unknown }).value)),
  }));
  if (params.aggregate === "sum") {
    const total = amounts.reduce((s, a) => s + a.c, 0);
    const data = { total: money(total, currency), limit: params.limit };
    if (total > limit)
      return verdict(
        "FAIL",
        `Cəmi ${fmt(total, currency)} limiti (${fmt(limit, currency)}) ${fmt(total - limit, currency)} aşır.`,
        evidence,
        data,
      );
    return verdict(
      "PASS",
      `Cəmi ${fmt(total, currency)} limit (${fmt(limit, currency)}) daxilindədir.`,
      evidence,
      data,
    );
  }
  const over = amounts
    .filter((a) => a.c > limit)
    .map((a) => ({ document_id: a.doc.id, amount: money(a.c, currency) }));
  if (over.length)
    return verdict(
      "FAIL",
      `${over.length} məbləğ limitdən (${fmt(limit, currency)}) çoxdur.`,
      evidence,
      { over },
    );
  return verdict("PASS", `Hər məbləğ limit (${fmt(limit, currency)}) daxilindədir.`, evidence, {
    over,
  });
}
