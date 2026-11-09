// UNKNOWN branches of the backend engine (apps/api/src/payproof/domain/rules), same messages.
import { describe, expect, it } from "vitest";
import { evaluate } from "../src/engine";
import { createMockDb, type MockDb } from "../src/store";
import type { EnginePkg } from "../src/types";

/** pkg_1038 passes every rule; `mutate` makes one value unread. */
function run(mutate: (p: EnginePkg, db: MockDb) => void) {
  const db = createMockDb();
  const p: EnginePkg = db.pkg("pkg_1038");
  mutate(p, db);
  return Object.fromEntries(evaluate(db, p).map((c) => [c.rule_id, c]));
}

describe("R-003 unread buyer", () => {
  it("UNKNOWN when the delivery note's buyer was not read", () => {
    const c = run((p) => (p.delivery!.customer_id = null));
    expect(c["R-003"]).toMatchObject({
      outcome: "UNKNOWN",
      cascade: false,
      fix_hint: "edit_field",
      message: "Təhvil sənədində alıcı oxunmadı — tərəflərin uyğunluğu təsdiqlənmir.",
    });
    expect(c["R-003"]!.evidence.map((e) => e.doc)).toEqual(["delivery"]);
  });

  it("an order of another buyer still FAILs when the delivery buyer is unread", () => {
    const c = run((p, db) => {
      p.delivery!.customer_id = null;
      db.orders["PO-377"]!.customer_id = "c2";
    });
    expect(c["R-003"]).toMatchObject({ outcome: "FAIL", fix_hint: null });
  });
});

describe("R-007 / R-008 unread delivery note fields", () => {
  it("R-007 UNKNOWN when the note's PO was not read; R-008 cascades", () => {
    const c = run((p) => (p.delivery!.po_ref = null));
    expect(c["R-007"]).toMatchObject({
      outcome: "UNKNOWN",
      cascade: false,
      fix_hint: "edit_field",
      message: "TS-5524 sənədində sifariş nömrəsi oxunmadı. Uyğunluq təsdiqlənməyib.",
    });
    expect(c["R-007"]!.evidence.map((e) => e.doc)).toEqual(["delivery"]);
    expect(c["R-008"]).toMatchObject({ outcome: "UNKNOWN", cascade: true });
  });

  it("R-007 names an unread note number 'Təhvil'", () => {
    const c = run((p) => {
      p.delivery!.po_ref = null;
      p.delivery!.note_number = null;
    });
    expect(c["R-007"]!.message).toBe(
      "Təhvil sənədində sifariş nömrəsi oxunmadı. Uyğunluq təsdiqlənməyib.",
    );
  });

  it("R-008 an unread signature is not FAIL: a person decides", () => {
    const unreviewed = run((p) => {
      p.delivery!.signed = null;
      p.signature_reviewed = false;
    });
    expect(unreviewed["R-008"]).toMatchObject({
      outcome: "UNKNOWN",
      fix_hint: "review_signature",
      message: "İmza tələb olunur: əməkdaş sənədə baxıb imzanın mövcudluğunu təsdiqləməlidir.",
    });
    expect(run((p) => (p.delivery!.signed = null))["R-008"]!.outcome).toBe("PASS");
  });
});

describe("R-004 units", () => {
  it("UNKNOWN on a unit mismatch; prices and quantities cascade", () => {
    const c = run((p) => (p.invoice.lines[1]!.unit = "ədəd"));
    expect(c["R-004"]).toMatchObject({
      outcome: "UNKNOWN",
      fix_hint: null,
      data: { unit_mismatch: ["CQ-250"] },
      message:
        "Ölçü vahidi fərqlidir: CQ-250 (faktura: ədəd, sifariş: qutu). Təsdiqlənmiş çevirmə qaydası olmadığı üçün qiymət müqayisəsi dayandırıldı.",
    });
    expect(c["R-005"]).toMatchObject({ outcome: "UNKNOWN", cascade: true });
    expect(c["R-006"]).toMatchObject({ outcome: "UNKNOWN", cascade: true });
  });

  it("UNKNOWN when a unit was not read, naming the document", () => {
    const c = run((p, db) => {
      p.invoice.lines[0]!.unit = null;
      db.orders["PO-377"]!.lines.find((l) => l.product_code === "CQ-250")!.unit = null;
    });
    expect(c["R-004"]).toMatchObject({
      outcome: "UNKNOWN",
      fix_hint: "edit_field",
      data: { unit_unread: ["ST-1", "CQ-250"] },
      message:
        "Ölçü vahidi oxunmadı: ST-1 (faktura); CQ-250 (sifariş). Vahid uyğunluğu təsdiqlənmədən qiymət müqayisəsi dayandırıldı.",
    });
  });
});

const NO_LINES = {
  outcome: "UNKNOWN",
  cascade: false,
  fix_hint: "edit_field",
  message: "Faktura sətirləri oxunmadı. Mənbəyə baxıb sahəni təsdiqləyin.",
  evidence: [],
};

describe("R-005 / R-006 / R-009 unread invoice lines and amounts", () => {
  it("no invoice lines read: UNKNOWN, never a vacuous PASS", () => {
    const c = run((p) => (p.invoice.lines = []));
    for (const rule of ["R-005", "R-006", "R-009"]) expect(c[rule]).toMatchObject(NO_LINES);
  });

  it("unread unit price: R-005 and R-009 UNKNOWN", () => {
    const c = run((p) => (p.invoice.lines[1]!.unit_price = null));
    expect(c["R-005"]).toMatchObject({
      outcome: "UNKNOWN",
      fix_hint: "edit_field",
      message: "Vahid qiymət və ya miqdar oxunmadı: CQ-250. Mənbəyə baxıb sahəni təsdiqləyin.",
    });
    expect(c["R-006"]!.outcome).toBe("PASS");
    expect(c["R-009"]).toMatchObject({
      outcome: "UNKNOWN",
      fix_hint: "edit_field",
      message: "Sətirlərin cəmi və ya yekun məbləğ oxunmadı. Mənbəyə baxıb sahəni təsdiqləyin.",
    });
  });

  it("unread invoice quantity: R-005 and R-006 UNKNOWN", () => {
    const c = run((p) => (p.invoice.lines[0]!.qty = null));
    expect(c["R-005"]!.message).toBe(
      "Vahid qiymət və ya miqdar oxunmadı: ST-1. Mənbəyə baxıb sahəni təsdiqləyin.",
    );
    expect(c["R-006"]).toMatchObject({
      outcome: "UNKNOWN",
      fix_hint: "edit_field",
      message: "Miqdar oxunmadı: ST-1. Mənbəyə baxıb sahəni təsdiqləyin.",
    });
  });

  it("unread delivered quantity of a linked note: R-006 UNKNOWN, codes listed once", () => {
    const c = run((p) => {
      p.invoice.lines[0]!.qty = null;
      for (const l of p.delivery!.lines) l.qty = null;
    });
    expect(c["R-006"]!.message).toBe(
      "Miqdar oxunmadı: ST-1, CQ-250. Mənbəyə baxıb sahəni təsdiqləyin.",
    );
    expect(c["R-006"]!.evidence.map((e) => e.doc)).toEqual(["invoice", "delivery", "delivery"]);
  });

  it("unread invoice total: R-009 UNKNOWN with the total as evidence", () => {
    const c = run((p) => (p.invoice.total = null));
    expect(c["R-009"]).toMatchObject({ outcome: "UNKNOWN", fix_hint: "edit_field" });
    expect(c["R-009"]!.evidence).toEqual([
      { doc: "invoice", hl: "total", quote: "Yekun: oxunmur" },
    ]);
  });
});
