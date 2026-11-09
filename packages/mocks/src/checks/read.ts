// Reading extracted values for the generic checks: a value is OK only if it was read and has a source.
import type { EvidenceRef, FieldRef, GenericDoc, GenericPkg } from "./types";

export type Read =
  | { status: "ok"; value: unknown; evidence: EvidenceRef }
  | { status: "unreadable"; evidence: EvidenceRef | null }
  | { status: "missing" };

export const docsOf = (p: GenericPkg, type: string) => p.documents.filter((d) => d.type === type);

/** The source of `key` (`seller`, `lines[0]`) in a document, or null. */
export function cite(d: GenericDoc, key: string): EvidenceRef | null {
  const e = d.evidence[key];
  return e ? { document_id: d.id, field: key, page: e.page, quote: e.quote } : null;
}

/** First-page fallback citation for a document as a whole (unreadable field without its own source). */
const whole = (d: GenericDoc): EvidenceRef => ({
  document_id: d.id,
  field: "document",
  page: 1,
  quote: d.file_name,
});

/** `field` or `party.part` of one document. A value without a source is never treated as read. */
export function read(d: GenericDoc, field: string): Read {
  const [top, part] = field.split(".") as [string, string | undefined];
  if (d.unreadable.includes(top))
    return { status: "unreadable", evidence: cite(d, top) ?? whole(d) };
  let value = d.fields[top];
  if (part !== undefined && value !== null && typeof value === "object")
    value = (value as Record<string, unknown>)[part];
  const evidence = cite(d, top);
  if (value === null || value === undefined || !evidence) return { status: "missing" };
  return { status: "ok", value, evidence };
}

/** Every document of the reference's type, with its read value. */
export const readAll = (p: GenericPkg, ref: FieldRef) =>
  docsOf(p, ref.document_type).map((d) => ({ doc: d, r: read(d, ref.field) }));

/** Azerbaijani-aware name normalization for counterparty comparison: case, diacritics, legal form. */
export function normalizeName(s: string): string {
  const map: Record<string, string> = { ə: "e", ı: "i", ö: "o", ü: "u", ş: "s", ç: "c", ğ: "g" };
  return s
    .replace(/İ/g, "i")
    .toLowerCase()
    .replace(/[əıöüşçğ]/g, (c) => map[c] ?? c)
    .replace(/\b(mmc|asc|qsc|llc|ltd)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Same counterparty when one normalized name contains the other (bank descriptors shorten names). */
export function sameCounterparty(a: string, b: string): boolean {
  const x = normalizeName(a);
  const y = normalizeName(b);
  return x.length > 0 && y.length > 0 && (x.includes(y) || y.includes(x));
}

/** Whole days from `a` to `b` (ISO dates). */
export const daysBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;
