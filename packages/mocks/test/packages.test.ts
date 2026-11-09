import { describe, expect, it } from "vitest";
import expected from "../../../fixtures/expected.json";
import { createPackage, finishProcessing } from "../src/domain/packages";
import { info } from "../src/engine/status";
import { createMockDb } from "../src/store";

type Db = ReturnType<typeof createMockDb>;
/** Uploaded files of a demo set, keyed by form field (order of `files` is invoice, order, delivery). */
const filesOf = (db: Db, inv: string) => {
  const s = db.newsets.find((n) => n.invoice_number === inv)!;
  return {
    set: s,
    files: {
      invoice: s.files[0]!,
      order: s.files[1],
      delivery: s.delivery ? s.files[2] : undefined,
    },
  };
};

describe("package lifecycle", () => {
  it.each(Object.entries(expected.newsets))(
    "new set %s is PROCESSING, then reaches its expected status",
    async (inv, want) => {
      const db = createMockDb();
      const { set, files } = filesOf(db, inv);
      const p = await createPackage(
        db,
        { customer_id: set.customer_id, owner_id: "u1", files },
        "u1",
      );
      expect(p).toMatchObject({ id: `pkg_${inv.slice(4)}`, processing: true, version: 1 });
      expect(info(db, p).status).toBe("PROCESSING");
      finishProcessing(db, p);
      expect(p.order_link).toMatchObject({
        confirmed: true,
        method: "exact_id",
        confirmed_by: "system",
      });
      const i = info(db, p);
      expect(i.status).toBe(want.status);
      expect(i.primary.map((c) => ({ rule_id: c.rule_id, outcome: c.outcome }))).toEqual(
        want.blockers,
      );
    },
  );

  it("documents follow the form fields; no delivery upload → no delivery note (R-007 FAIL)", async () => {
    const db = createMockDb();
    const { set } = filesOf(db, "INV-1051");
    const p = await createPackage(
      db,
      {
        customer_id: set.customer_id,
        owner_id: "u1",
        files: { invoice: "INV-1051.pdf", delivery: "TS-5547.jpg" },
      },
      "u1",
    );
    expect(p.documents.map((d) => d.type)).toEqual(["invoice", "delivery"]);
    const q = await createPackage(
      createMockDb(),
      { customer_id: set.customer_id, owner_id: "u1", files: { invoice: "INV-1051.pdf" } },
      "u1",
    );
    expect(q.delivery).toBeNull();
    expect(q.documents.map((d) => d.type)).toEqual(["invoice"]);
  });

  it("rejects files that are not a demo set (mock mode cannot extract them)", async () => {
    const db = createMockDb();
    await expect(
      createPackage(
        db,
        { customer_id: "c1", owner_id: "u1", files: { invoice: "random.pdf" } },
        "u1",
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 422 });
  });

  it("reports a duplicate invoice for the same customer", async () => {
    const db = createMockDb();
    const { set, files } = filesOf(db, "INV-1051");
    await createPackage(db, { customer_id: set.customer_id, owner_id: "u1", files }, "u1");
    await expect(
      createPackage(db, { customer_id: set.customer_id, owner_id: "u1", files }, "u1"),
    ).rejects.toMatchObject({ code: "DUPLICATE_INVOICE" });
  });
});
