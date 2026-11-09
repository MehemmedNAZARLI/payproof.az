import { describe, expect, it } from "vitest";
import { createDemoDb } from "../src/domain/seed";
import { checks, documents, fieldById, fields } from "../src/views/documents";
import { assertSchema } from "./contract";

describe("documents, fields and checks", () => {
  const db = createDemoDb();

  it("documents list the current version and older ones newest first", () => {
    const docs = documents(db, db.pkg("pkg_1036"));
    for (const d of docs) assertSchema("Document", d);
    const dl = docs.find((d) => d.type === "delivery")!;
    expect(dl.current).toMatchObject({ version_no: 3, file_name: "TS-5518_imzali_tam.pdf" });
    expect(dl.history.map((v) => v.version_no)).toEqual([2, 1]);
  });

  it("an unreadable PO is REVIEW_REQUIRED with the raw OCR text and its source quote", () => {
    const fs = fields(db, db.pkg("pkg_1047"));
    for (const f of fs) assertSchema("ExtractedField", f);
    expect(fs[0]).toMatchObject({
      field_path: "invoice.po_ref",
      raw_value: "PO-3?7",
      value: null,
      review_status: "REVIEW_REQUIRED",
      evidence: { page: 1, quote: "Sifariş №: PO-3?7 (oxunmur)" },
    });
    expect(fs.map((f) => f.field_path)).toEqual([
      "invoice.po_ref",
      "invoice.lines[GY-1L].qty",
      "invoice.lines[GY-1L].unit_price",
    ]);
  });

  it("field ids round-trip to package and path", () => {
    const p = db.pkg("pkg_1044");
    for (const f of fields(db, p))
      expect(fieldById(db, f.id)).toEqual({ pkg: p, path: f.field_path });
    expect(fieldById(db, "0193a000-0000-7000-800c-999999999999")).toBeNull();
  });

  it("checks carry the contract shape, titles and evidence bound to document versions", () => {
    const cs = checks(db, db.pkg("pkg_1044"));
    for (const c of cs) assertSchema("CheckResult", c);
    const r005 = cs.find((c) => c.rule_id === "R-005")!;
    expect(r005).toMatchObject({ title: "Vahid qiymət uyğunluğu", fix_hint: "upload_invoice" });
    expect(r005.evidence.map((e) => e.document_version_id)).toEqual([
      "0193a000-0000-7000-8005-000010441001",
      "0193a000-0000-7000-8005-000010442001",
    ]);
  });
});
