import { describe, expect, it } from "vitest";
import { ev } from "../src/engine/evidence";
import { createMockDb } from "../src/store";

describe("evidence quotes (prototype ev())", () => {
  const db = createMockDb();
  const p = db.pkg("pkg_1044");
  const order = db.orders["PO-388"]!;

  it("quotes invoice and order lines with az-AZ money", () => {
    expect(ev(db, p, order, "invoice", "line:KY-10")?.quote).toBe(
      "Kərə yağı 82%, 10 kq blok — 50 blok × 110,00",
    );
    expect(ev(db, p, order, "order", "line:KY-10")?.quote).toBe(
      "Kərə yağı 82%, 10 kq blok — 50 blok × 100,00",
    );
  });
  it("quotes totals with the currency", () => {
    expect(ev(db, p, order, "invoice", "total")?.quote).toBe("Yekun: 6.900,00 AZN");
  });
  it("has no evidence for a document that is not in the package", () => {
    expect(ev(db, db.pkg("pkg_1042"), null, "order", "po")).toBeNull();
    expect(ev(db, db.pkg("pkg_1042"), null, "delivery", "signature")).toBeNull();
  });
});
