// Documents (current + history), extracted fields with evidence, and check results.
import type { Schemas } from "@payproof/api-client";
import { ruleTitle } from "@payproof/api-client/i18n";
import { ev, type Ev } from "../engine/evidence";
import { evaluate, type Check } from "../engine";
import { id, type DocType } from "../ids";
import type { MockDb } from "../store";
import type { Pkg } from "../types";
import { userRef } from "./records";

const currentNo = (p: Pkg, type: DocType) =>
  p.documents.find((d) => d.type === type)?.versions.at(-1)?.version_no ?? 1;
const linkedOrder = (db: MockDb, p: Pkg) =>
  p.order_link.confirmed && p.order_link.po_number
    ? (db.orders[p.order_link.po_number] ?? null)
    : null;

export const evidence = (p: Pkg, e: Ev): Schemas["Evidence"] => ({
  document_version_id: id.version(p.id, e.doc, currentNo(p, e.doc)),
  page: 1,
  quote: e.quote,
  bbox: null,
});

export const documents = (db: MockDb, p: Pkg): Schemas["Document"][] =>
  p.documents.map((d) => {
    const versions = d.versions.map((v) => ({
      id: id.version(p.id, d.type, v.version_no),
      version_no: v.version_no,
      file_name: v.file_name,
      source_kind: v.source_kind,
      status: v.status,
      sha256: v.sha256,
      uploaded_by: userRef(db, v.uploaded_by),
      uploaded_at: v.uploaded_at,
      package_version_at_upload: v.package_version_at_upload,
    }));
    return {
      id: id.document(p.id, d.type),
      type: d.type,
      current: versions.at(-1)!,
      history: versions.slice(0, -1).reverse(),
    };
  });

/** Editable extracted fields in a stable order: PO, then qty and unit price per invoice line. */
export const fieldPaths = (p: Pkg) => [
  "invoice.po_ref",
  ...p.invoice.lines.flatMap((l) => [
    `invoice.lines[${l.product_code}].qty`,
    `invoice.lines[${l.product_code}].unit_price`,
  ]),
];

export function fields(db: MockDb, p: Pkg): Schemas["ExtractedField"][] {
  const o = linkedOrder(db, p);
  const dv = id.version(p.id, "invoice", currentNo(p, "invoice"));
  return fieldPaths(p).map((path, i) => {
    const corrected = !!p.corrections?.[path];
    const status = (review: boolean) =>
      (corrected
        ? "CORRECTED"
        : review
          ? "REVIEW_REQUIRED"
          : "EXTRACTED") as Schemas["ExtractedField"]["review_status"];
    const field = (
      label: string,
      raw: string | null,
      value: string | null,
      review: boolean,
      hl: string,
    ) => {
      const e = ev(db, p, o, "invoice", hl);
      return {
        id: id.field(p.id, "invoice", i + 1),
        document_version_id: dv,
        field_path: path,
        label,
        raw_value: raw,
        value,
        review_status: status(review),
        evidence: e && evidence(p, e),
      };
    };
    if (path === "invoice.po_ref") {
      const unread = p.invoice.unreadable_fields.includes("po_ref");
      return field(
        "Sifariş № (PO)",
        unread ? p.invoice.po_raw : p.invoice.po_ref,
        p.invoice.po_ref,
        unread,
        "po",
      );
    }
    const code = path.slice(14, path.indexOf("]"));
    const line = p.invoice.lines.find((l) => l.product_code === code)!;
    return path.endsWith(".qty")
      ? field(`${code} miqdarı`, String(line.qty), String(line.qty), false, `line:${code}`)
      : field(`${code} vahid qiyməti`, line.unit_price, line.unit_price, false, `line:${code}`);
  });
}

export function fieldById(db: MockDb, uuid: string): { pkg: Pkg; path: string } | null {
  for (const p of db.packages) {
    if (p.deleted) continue;
    const i = fieldPaths(p).findIndex((_, n) => id.field(p.id, "invoice", n + 1) === uuid);
    if (i >= 0) return { pkg: p, path: fieldPaths(p)[i]! };
  }
  return null;
}

export const checkResult = (p: Pkg, c: Check): Schemas["CheckResult"] => ({
  rule_id: c.rule_id,
  title: ruleTitle[c.rule_id as keyof typeof ruleTitle],
  outcome: c.outcome,
  cascade: c.cascade,
  message: c.message,
  evidence: c.evidence.map((e) => evidence(p, e)),
  fix_hint: c.fix_hint,
  data: c.data,
});

export const checks = (db: MockDb, p: Pkg) =>
  p.processing ? [] : evaluate(db, p).map((c) => checkResult(p, c));
