// Output template values (ADR-0011 §4): only mapped placeholders, only from validated sources.
// Any missing value refuses the export — a partially filled document is never produced.
import { cents, decimal } from "../money";
import { docsOf, read } from "./read";
import type { GenericPkg, GenericRequirementSet, PlaceholderSource } from "./types";

export interface Approval {
  approver_name: string;
  approved_on: string;
}
export interface TemplateFill {
  values: { placeholder: string; value: string }[];
  missing: { placeholder: string; source: PlaceholderSource }[];
}

function valueOf(p: GenericPkg, s: PlaceholderSource, approval: Approval | null): string | null {
  switch (s.kind) {
    case "package":
      return p.reference;
    case "approval":
      return approval?.[s.value] ?? null;
    case "field": {
      const docs = docsOf(p, s.document_type);
      const r = docs.length === 1 ? read(docs[0]!, s.field) : null;
      return r?.status === "ok" ? String(r.value) : null;
    }
    case "aggregate": {
      const docs = docsOf(p, s.document_type);
      if (s.op === "count") return String(docs.length);
      const reads = docs.map((d) => ({
        r: read(d, s.field ?? ""),
        cur: String(d.fields.currency),
      }));
      const currencies = new Set(reads.map((x) => x.cur));
      if (!docs.length || currencies.size !== 1 || reads.some((x) => x.r.status !== "ok"))
        return null;
      const total = reads.reduce(
        (sum, x) => sum + cents(String((x.r as { value: unknown }).value)),
        0,
      );
      return `${decimal(total)} ${[...currencies][0]}`;
    }
  }
}

/** Values for every mapped placeholder; `missing` non-empty → export refused (422, missing_placeholders). */
export function fillTemplate(
  p: GenericPkg,
  rs: GenericRequirementSet,
  approval: Approval | null,
): TemplateFill {
  const fill: TemplateFill = { values: [], missing: [] };
  for (const { placeholder, source } of rs.output?.placeholders ?? []) {
    const value = valueOf(p, source, approval);
    if (value === null) fill.missing.push({ placeholder, source });
    else fill.values.push({ placeholder, value });
  }
  return fill;
}
