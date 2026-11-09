import { describe, expect, it } from "vitest";
import expected from "../../../fixtures/expected.json";
import { createDemoDb } from "../src/domain/seed";
import { dashboard, listItem } from "../src/views/overview";
import { assertSchema } from "./contract";

describe("overview serializers", () => {
  const db = createDemoDb();

  it("package list items conform and carry the primary blockers", () => {
    for (const p of db.packages) assertSchema("PackageListItem", listItem(db, p));
    expect(listItem(db, db.pkg("pkg_1042"))).toMatchObject({
      invoice_number: "INV-1042",
      status: "NEEDS_REVIEW",
      total: { amount: "12000.00", currency: "AZN" },
      po_ref: null,
      blocking: expected.packages["INV-1042"].blockers,
      problem_since: "2026-11-03T05:12:00Z",
    });
    expect(listItem(db, db.pkg("pkg_1047")).po_unreadable).toBe(true);
  });

  it("dashboard = expected.json (amounts per currency, never summed across)", () => {
    const d = dashboard(db);
    assertSchema("Dashboard", d);
    expect(d.status_counts).toEqual(expected.dashboard.status_counts);
    expect(d.open_problem_amounts).toEqual(
      expected.dashboard.open_problem_amounts.map((x) => ({
        total: { amount: x.amount, currency: x.currency },
        package_count: x.packages,
      })),
    );
    expect(d.problem_age).toEqual({
      average_days: expected.dashboard.avg_problem_days,
      longest: {
        package: { id: "0193a000-0000-7000-8002-000000001042", invoice_number: "INV-1042" },
        days: expected.dashboard.longest_problem.days,
      },
    });
    expect(d).toMatchObject({
      package_count: 14,
      customer_count: 2,
      tasks: { resolved: 3, total: 9 },
    });
    expect(d.ready_amounts).toEqual([
      { total: { amount: "11060.00", currency: "AZN" }, package_count: 2 },
    ]);
  });

  it("recent approvals are newest first and say whether they are still valid", () => {
    const d = dashboard(db);
    expect(d.recent_approvals.map((a) => [a.package.invoice_number, a.valid, a.exported])).toEqual([
      ["INV-1035", true, false],
      ["INV-1036", false, false],
      ["INV-1033", true, true],
      ["INV-1031", true, true],
    ]);
  });
});
