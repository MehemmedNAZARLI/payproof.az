// Check library families (ADR-0011) — document count, presence and equality. Deterministic, no AI.
import { documentTypeName } from "../domain/legacy-profile";
import { cents } from "../money";
import { docsOf, readAll, whole } from "./read";
import type { EvidenceRef, FieldRef, GenericPkg, GenericRequirementSet, Verdict } from "./types";
import { MONEY, NA, verdict } from "./verdict";

const label = (r: FieldRef) => `${documentTypeName(r.document_type)}: ${r.field}`;

export function documentCount(p: GenericPkg, rs: GenericRequirementSet): Verdict {
  const counts = Object.fromEntries(rs.documents.map((r) => [r.type, docsOf(p, r.type).length]));
  const bad = rs.documents.filter((r) => {
    const n = counts[r.type] ?? 0;
    return n < r.min_count || (r.max_count !== null && n > r.max_count);
  });
  const evidence = p.documents.filter((d) => d.type in counts).map(whole);
  const list = rs.documents.map((r) => `${documentTypeName(r.type)} ${counts[r.type]}`).join(", ");
  if (!bad.length) return verdict("PASS", `Sənəd dəsti tamdır: ${list}.`, evidence, { counts });
  const what = bad
    .map(
      (r) =>
        `${documentTypeName(r.type)} (tələb: ${r.min_count}–${r.max_count ?? "∞"}, var: ${counts[r.type]})`,
    )
    .join("; ");
  const missing = bad.filter((r) => (counts[r.type] ?? 0) < r.min_count).map((r) => r.type);
  return verdict("FAIL", `Sənəd sayı tələbə uyğun deyil: ${what}.`, evidence, { counts, missing });
}

export function fieldPresent(p: GenericPkg, params: { targets: FieldRef[] }): Verdict {
  const missing: { document_id: string; field: string }[] = [];
  const unreadable: { document_id: string; field: string }[] = [];
  const evidence: EvidenceRef[] = [];
  for (const t of params.targets)
    for (const { doc, r } of readAll(p, t)) {
      const at = { document_id: doc.id, field: t.field };
      if (r.status === "missing") {
        missing.push(at);
        evidence.push(whole(doc));
      } else {
        if (r.status === "unreadable") unreadable.push(at);
        if (r.evidence) evidence.push(r.evidence);
      }
    }
  if (!evidence.length) return NA("Yoxlanacaq sənəd yoxdur.");
  const data = { missing, unreadable };
  if (missing.length)
    return verdict("FAIL", `${missing.length} məcburi sahə sənəddə yoxdur.`, evidence, data);
  if (unreadable.length)
    return verdict(
      "UNKNOWN",
      `${unreadable.length} sahə oxunmadı — mənbəyə əsasən düzəldin.`,
      evidence,
      data,
    );
  return verdict(
    "PASS",
    `Bütün məcburi sahələr mənbə ilə çıxarılıb (${evidence.length}).`,
    evidence,
    data,
  );
}

export function valuesEqual(
  p: GenericPkg,
  params: { fields: FieldRef[]; tolerance?: string; normalize?: "exact" | "casefold" },
): Verdict {
  const values: { document_id: string; field: string; value: string }[] = [];
  const evidence: EvidenceRef[] = [];
  let unknown = false;
  for (const f of params.fields)
    for (const { doc, r } of readAll(p, f)) {
      if (r.status === "ok") {
        values.push({ document_id: doc.id, field: label(f), value: String(r.value) });
        evidence.push(r.evidence);
      } else {
        unknown = true;
        if (r.status === "unreadable" && r.evidence) evidence.push(r.evidence);
      }
    }
  if (unknown) return verdict("UNKNOWN", "Müqayisə üçün dəyər oxunmayıb.", evidence, { values });
  if (values.length < 2) return NA("Müqayisə üçün ən azı iki dəyər lazımdır.");
  const tol = cents(params.tolerance ?? "0.00");
  const isMoney = values.every((v) => MONEY.test(v.value));
  const key = (s: string) => (params.normalize === "casefold" ? s.trim().toLowerCase() : s);
  const first = values[0]!.value;
  const differs = values.some((v) =>
    isMoney ? Math.abs(cents(v.value) - cents(first)) > tol : key(v.value) !== key(first),
  );
  const shown = [...new Set(values.map((v) => v.value))].join(" / ");
  if (differs) return verdict("FAIL", `Dəyərlər fərqlidir: ${shown}.`, evidence, { values });
  return verdict("PASS", `Dəyərlər bütün sənədlərdə eynidir: ${shown}.`, evidence, { values });
}
