import { expect, it } from "vitest";
import { log } from "../src/domain/audit";
import { createMockDb } from "../src/store";

it("audit events are appended with the package version and system actor as null", () => {
  const db = createMockDb();
  log(db, { actor: "system", action: "validation.run", message: "x", pkg: "pkg_1036" });
  log(db, { actor: "u1", action: "task.created", message: "y" });
  expect(db.audit.map((e) => [e.seq, e.actor_id, e.package_version, e.invoice_number])).toEqual([
    [1, null, 3, "INV-1036"],
    [2, "u1", null, null],
  ]);
});
