import { describe, expect, it } from "vitest";
import { createPackage, deletePackage } from "../src/domain/packages";
import { saveRequirements } from "../src/domain/rules";
import { info } from "../src/engine/status";
import { createMockDb } from "../src/store";

describe("delete and requirement changes", () => {
  it("re-creating a deleted invoice gets a new id (no history mixing)", async () => {
    const db = createMockDb();
    const input = { customer_id: "c1", owner_id: "u1", files: { invoice: "INV-1052.pdf" } };
    const first = await createPackage(db, input, "u1");
    deletePackage(db, first, "u1");
    const again = await createPackage(db, input, "u1");
    expect(again.id).not.toBe(first.id);
    const actions = db.audit.filter((e) => e.package_id === again.id).map((e) => e.action);
    expect(actions).not.toContain("package.deleted");
  });

  it("deletes only packages that were never approved (soft, audited)", () => {
    const db = createMockDb();
    deletePackage(db, db.pkg("pkg_1043"), "u1");
    expect(db.pkg("pkg_1043").deleted).toBe(true);
    expect(db.tasks.some((t) => t.package_id === "pkg_1043")).toBe(false);
    expect(db.audit.at(-1)).toMatchObject({ action: "package.deleted", actor_id: "u1" });
    for (const id of ["pkg_1036", "pkg_1038"])
      expect(() => deletePackage(db, db.pkg(id), "u1")).toThrow(
        expect.objectContaining({ code: "PACKAGE_NOT_DELETABLE", status: 409 }),
      );
  });

  it("a new rule set bumps every not-exported package of the customer (ADR-0009)", () => {
    const db = createMockDb();
    const c2 = db.customer("c2");
    const set = saveRequirements(
      db,
      c2,
      {
        ...c2.requirement_sets[0]!,
        effective_from: "2026-12-01",
        reason: "Dekabrdan imza tələb olunur.",
      },
      "u2",
    );
    expect(set).toMatchObject({ version: 2, approved_by: "u2" });
    expect(db.pkg("pkg_1035")).toMatchObject({ version: 2 });
    expect(db.pkg("pkg_1035").approvals[0]).toMatchObject({ valid: false });
    expect(info(db, db.pkg("pkg_1035")).status).toBe("READY_FOR_APPROVAL");
    expect(db.notifications.at(-1)).toMatchObject({ user_id: "u2", package_id: "pkg_1035" });
    // other c2 packages move to a new version too; c1 packages and processing ones do not
    expect(db.pkg("pkg_1045").version).toBe(2);
    expect(db.pkg("pkg_1044").version).toBe(1);
    expect(db.pkg("pkg_1050").version).toBe(1);
    // an exported version keeps the rules it was exported under
    expect(db.pkg("pkg_1031")).toMatchObject({ version: 1 });
    expect(info(db, db.pkg("pkg_1031")).status).toBe("EXPORTED");
    expect(db.pkg("pkg_1031").approvals[0]!.valid).toBe(true);
  });
});
