import { describe, expect, it } from "vitest";
import { createDemoDb } from "../src/domain/seed";

describe("demo seed (prototype reset())", () => {
  const db = createDemoDb();

  it("derives an audit trail from fixtures, ordered by time", () => {
    expect(db.audit.length).toBeGreaterThan(80);
    const times = db.audit.map((e) => e.created_at);
    expect([...times].sort()).toEqual(times);
    expect(db.audit.map((e) => e.seq)).toEqual(db.audit.map((_, i) => i + 1));
  });

  it("records the INV-1036 approval invalidation by the system", () => {
    expect(db.audit).toContainEqual(
      expect.objectContaining({
        action: "approval.invalidated",
        actor_id: null,
        package_id: "pkg_1036",
      }),
    );
  });

  it("problem packages start their problem age at creation; others have none", () => {
    expect(db.pkg("pkg_1042").problem_since).toBe("2026-11-03T05:12:00Z");
    expect(db.pkg("pkg_1038").problem_since).toBeNull();
    expect(db.pkg("pkg_1050").problem_since).toBeNull();
  });

  it("updated_at is the time of the package's last audit event", () => {
    for (const p of db.packages) {
      const last = db.audit.filter((e) => e.package_id === p.id).at(-1)!;
      expect(p.updated_at).toBe(last.created_at);
    }
  });

  it("never names an assignee as actor (ADR-0008)", () => {
    const assignees = new Set(db.users.filter((u) => u.role === "assignee").map((u) => u.id));
    expect(db.audit.filter((e) => e.actor_id && assignees.has(e.actor_id))).toEqual([]);
  });
});
