import { describe, expect, it } from "vitest";
import { createMockDb } from "../src/store";

describe("mock store from fixtures", () => {
  it("loads the demo dataset", () => {
    const db = createMockDb();
    expect(db.packages).toHaveLength(14);
    expect(Object.keys(db.orders)).toHaveLength(18);
    expect(db.customers).toHaveLength(2);
    expect(db.users).toHaveLength(7);
    expect(db.tasks).toHaveLength(9);
    expect(db.samples).toHaveLength(8);
    expect(db.newsets).toHaveLength(2);
  });

  it("starts the clock at the demo time and advances 2 minutes per action", () => {
    const db = createMockDb();
    expect(db.nowIso()).toBe("2026-11-08T06:30:00Z");
    expect(db.tick()).toBe("2026-11-08T06:32:00Z");
    expect(db.nowIso()).toBe("2026-11-08T06:32:00Z");
  });

  it("keeps fixtures untouched (each db is an independent copy)", () => {
    const a = createMockDb();
    a.packages[0]!.version = 99;
    expect(createMockDb().packages[0]!.version).not.toBe(99);
  });

  it("converts fixture wall-clock times to UTC", () => {
    const p = createMockDb().pkg("pkg_1042");
    expect(p.created_at).toBe("2026-11-03T05:12:00Z");
  });
});
