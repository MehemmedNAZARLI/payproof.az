// Check library families (ADR-0011) — duplicate use, party identity and line item matching.
import { cents } from "../money";
import { cite, docsOf, normalizeName, read, readAll, whole } from "./read";
import type { EvalContext, EvidenceRef, FieldRef, GenericPkg, Verdict } from "./types";
import { MONEY, NA, verdict } from "./verdict";

export function noDuplicateUse(
  p: GenericPkg,
  params: {
    subjects: { document_type: string; key_fields: string[] }[];
    scope: "package" | "customer";
  },
  ctx: EvalContext,
): Verdict {
  const evidence: EvidenceRef[] = [];
  const duplicates: { document_id: string; key: string; package: string }[] = [];
  let unknown = false;
  const keyOf = (d: GenericPkg["documents"][number], fields: string[]) => {
    const r = fields.map((f) => read(d, f));
    return r.every((x) => x.status === "ok")
      ? r.map((x) => String((x as { value: unknown }).value)).join(" · ")
      : null;
  };
  const others =
    params.scope === "customer"
      ? ctx.others.filter((o) => o.customer_id === p.customer_id && o.id !== p.id)
      : [];
  for (const s of params.subjects) {
    const seen = new Map<string, string>();
    for (const o of others)
      for (const d of docsOf(o, s.document_type)) {
        const k = keyOf(d, s.key_fields);
        if (k) seen.set(k, o.reference);
      }
    for (const d of docsOf(p, s.document_type)) {
      const k = keyOf(d, s.key_fields);
      evidence.push(...s.key_fields.map((f) => cite(d, f.split(".")[0]!) ?? whole(d)));
      if (k === null) unknown = true;
      else if (seen.has(k)) duplicates.push({ document_id: d.id, key: k, package: seen.get(k)! });
      else seen.set(k, p.reference);
    }
  }
  if (!evidence.length) return NA("Yoxlanacaq sənəd yoxdur.");
  const unique = [...new Map(evidence.map((e) => [`${e.document_id}:${e.field}`, e])).values()];
  if (duplicates.length) {
    const what = duplicates.map((x) => `${x.key} (${x.package})`).join(", ");
    return verdict("FAIL", `Sənəd artıq istifadə olunub: ${what}.`, unique, { duplicates });
  }
  if (unknown)
    return verdict("UNKNOWN", "Təkrar yoxlaması üçün açar sahə oxunmayıb.", unique, { duplicates });
  return verdict("PASS", "Təkrar istifadə olunan sənəd yoxdur.", unique, { duplicates });
}

type Party = { name?: string; tax_id?: string; id_number?: string };
export function partyIdentityMatch(
  p: GenericPkg,
  params: { parties: FieldRef[]; match_on: ("tax_id" | "id_number" | "name")[] },
): Verdict {
  const read_ = params.parties.flatMap((ref) => readAll(p, ref));
  const evidence = read_.flatMap(({ r }) =>
    r.status !== "missing" && r.evidence ? [r.evidence] : [],
  );
  if (read_.length < 2) return NA("Müqayisə üçün ən azı iki tərəf lazımdır.");
  const parties = read_.map(({ r }) => (r.status === "ok" ? (r.value as Party) : null));
  const key = params.match_on.find((k) => parties.every((x) => x?.[k]));
  if (!key)
    return verdict(
      "UNKNOWN",
      "Tərəfləri müqayisə etmək üçün ortaq identifikator yoxdur.",
      evidence,
      {},
    );
  const norm = (v: string) => (key === "name" ? normalizeName(v) : v.trim().toUpperCase());
  const values = parties.map((x) => x![key]!);
  const data = { matched_on: key, values };
  if (new Set(values.map(norm)).size > 1)
    return verdict(
      "FAIL",
      `Tərəflər fərqlidir (${key}): ${[...new Set(values)].join(" / ")}.`,
      evidence,
      data,
    );
  return verdict(
    "PASS",
    `Bütün sənədlər eyni tərəfə aiddir (${key}: ${values[0]}).`,
    evidence,
    data,
  );
}

export function lineItemsMatch(
  p: GenericPkg,
  params: {
    left: { document_type: string; table: string };
    right: { document_type: string; table: string };
    key_column: string;
    compare: string[];
    tolerance?: string;
  },
): Verdict {
  const tol = cents(params.tolerance ?? "0.00");
  const rows = (side: typeof params.left) =>
    docsOf(p, side.document_type).flatMap((d) =>
      (d.tables[side.table] ?? []).map((row, i) => ({
        row,
        ev: cite(d, `${side.table}[${i}]`) ?? whole(d),
      })),
    );
  const left = rows(params.left);
  const right = rows(params.right);
  if (!left.length || !docsOf(p, params.right.document_type).length)
    return NA("Müqayisə üçün sətir yoxdur.");
  const evidence: EvidenceRef[] = [];
  const missing: string[] = [];
  const differences: { key: string; column: string; left: string; right: string }[] = [];
  for (const l of left) {
    const k = String(l.row[params.key_column]);
    const r = right.find((x) => String(x.row[params.key_column]) === k);
    evidence.push(l.ev);
    if (!r) {
      missing.push(k);
      continue;
    }
    evidence.push(r.ev);
    for (const c of params.compare) {
      const [a, b] = [String(l.row[c]), String(r.row[c])];
      const same = MONEY.test(a) && MONEY.test(b) ? Math.abs(cents(a) - cents(b)) <= tol : a === b;
      if (!same) differences.push({ key: k, column: c, left: a, right: b });
    }
  }
  const data = { missing, differences };
  if (differences.length) {
    const what = differences.map((x) => `${x.key} ${x.column}: ${x.left} ≠ ${x.right}`).join("; ");
    return verdict("FAIL", `Sətir fərqi — ${what}.`, evidence, data);
  }
  if (missing.length)
    return verdict(
      "UNKNOWN",
      `Qarşı sənəddə olmayan sətir: ${missing.join(", ")}.`,
      evidence,
      data,
    );
  return verdict("PASS", `${left.length} sətir tutuşur.`, evidence, data);
}
