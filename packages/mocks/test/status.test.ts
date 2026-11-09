import { describe, expect, it } from "vitest";
import expected from "../../../fixtures/expected.json";
import { info } from "../src/engine/status";
import { createMockDb } from "../src/store";

describe("derived package status = fixtures/expected.json", () => {
  it.each(Object.entries(expected.packages))("%s status and primary blockers", (_inv, e) => {
    const db = createMockDb();
    const i = info(db, db.pkg(e.package_id));
    expect(i.status).toBe(e.status);
    expect(i.primary.map((c) => ({ rule_id: c.rule_id, outcome: c.outcome }))).toEqual(e.blockers);
  });

  it("matches the dashboard status counts (14 packages)", () => {
    const db = createMockDb();
    const counts: Record<string, number> = {};
    for (const p of db.packages) counts[info(db, p).status] = (counts[info(db, p).status] ?? 0) + 1;
    expect(counts).toEqual(expected.dashboard.status_counts);
  });

  it("UNKNOWN blocks: a package with only UNKNOWN results is never ready", () => {
    const db = createMockDb();
    const i = info(db, db.pkg("pkg_1047"));
    expect(i.counts.fail).toBe(0);
    expect(i.status).toBe("NEEDS_REVIEW");
  });

  it("a new rule set version makes an existing approval stale (INV-1035 → READY_FOR_APPROVAL)", () => {
    const db = createMockDb();
    const c2 = db.customer("c2");
    c2.requirement_sets.push({ ...c2.requirement_sets[0]!, version: 2 });
    expect(info(db, db.pkg("pkg_1035")).status).toBe("READY_FOR_APPROVAL");
  });

  it("an exported version keeps the rule set it was exported under (INV-1031 stays EXPORTED)", () => {
    const db = createMockDb();
    const c2 = db.customer("c2");
    c2.requirement_sets.push({ ...c2.requirement_sets[0]!, version: 2, require_signature: true });
    expect(info(db, db.pkg("pkg_1031")).status).toBe("EXPORTED");
  });
});
