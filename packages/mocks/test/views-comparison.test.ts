import { describe, expect, it } from "vitest";
import { createDemoDb } from "../src/domain/seed";
import { comparison } from "../src/views/comparison";
import { assertSchema } from "./contract";

const row = (rows: ReturnType<typeof comparison>, key: string) => rows.find((r) => r.key === key)!;

describe("invoice · order · delivery comparison", () => {
  const db = createDemoDb();

  it("conforms to ComparisonRow for every package", () => {
    for (const p of db.packages)
      for (const r of comparison(db, p)) assertSchema("ComparisonRow", r);
  });

  it("INV-1044: the KY-10 price differs, quantities match the delivery note", () => {
    const rows = comparison(db, db.pkg("pkg_1044"));
    expect(row(rows, "lines[KY-10].unit_price")).toMatchObject({
      group: "KY-10 · Kərə yağı 82%, 10 kq blok",
      invoice: { value: "110.00", currency: "AZN", state: "mismatch" },
      order: { value: "100.00", currency: "AZN", state: "ok" },
      delivery: { value: null, state: "empty" },
    });
    expect(row(rows, "lines[KY-10].qty").delivery).toMatchObject({ value: "50", state: "ok" });
    expect(row(rows, "lines[KY-10].unit_price").invoice.field_id).not.toBeNull();
  });

  it("INV-1047: unreadable PO is unknown, not missing", () => {
    expect(row(comparison(db, db.pkg("pkg_1047")), "po_ref").invoice).toMatchObject({
      value: null,
      state: "unknown",
    });
  });

  it("INV-1042: no confirmed order and no delivery → empty cells", () => {
    const po = row(comparison(db, db.pkg("pkg_1042")), "po_ref");
    expect(po.invoice.state).toBe("mismatch");
    expect(po.order.state).toBe("empty");
    expect(po.delivery.state).toBe("empty");
  });

  it("INV-1049: the order price is in another currency → unknown, with its currency", () => {
    expect(row(comparison(db, db.pkg("pkg_1049")), "lines[ZY-1L].unit_price").order).toMatchObject({
      value: "12.75",
      currency: "AZN",
      state: "unknown",
    });
  });
});
