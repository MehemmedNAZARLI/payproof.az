import expected from "@fixtures/expected.json";
import { describe, expect, it } from "vitest";

import { dashboard } from "./dashboard";

// The contract example and expected.json both come from the prototype engine: the web
// dashboard (W-06) reads the same numbers, so mobile and web agree.
describe("mock dashboard", () => {
  const d = dashboard();

  it("counts packages by status like the golden result", () => {
    expect(d.status_counts).toEqual(expected.dashboard.status_counts);
    expect(d.package_count).toBe(14);
    expect(d.customer_count).toBe(2);
  });

  it("sums open problems per currency, never across currencies", () => {
    expect(d.open_problem_amounts).toEqual(
      expected.dashboard.open_problem_amounts.map((a) => ({
        total: { amount: a.amount, currency: a.currency },
        package_count: a.packages,
      })),
    );
  });

  it("sums what waits for approval", () => {
    expect(d.ready_amounts).toEqual([
      { total: { amount: "11060.00", currency: "AZN" }, package_count: 2 },
    ]);
  });

  it("finds the top issue and per-rule blockers among non-exported packages", () => {
    expect(d.top_issue).toEqual({
      category: "PO istinadı",
      rule_ids: ["R-001", "R-002"],
      package_count: 4,
      invoice_numbers: ["INV-1042", "INV-1043", "INV-1047", "INV-1048"],
    });
    expect(d.rule_counts.slice(0, 2)).toEqual([
      { rule_id: "R-001", fail: 2, unknown: 1 },
      { rule_id: "R-002", fail: 1, unknown: 2 },
    ]);
  });

  it("measures problem age in days from the demo's today", () => {
    expect(d.problem_age).toEqual({
      average_days: expected.dashboard.avg_problem_days,
      longest: {
        package: { id: expect.any(String), invoice_number: "INV-1042" },
        days: expected.dashboard.longest_problem.days,
      },
    });
    expect(d.as_of).toBe("2026-11-08T06:30:00Z");
  });

  it("counts tasks and lists recent approvals, newest first", () => {
    expect(d.tasks).toEqual({ resolved: 3, total: 9 });
    expect(d.recent_approvals[0]).toMatchObject({
      package: { invoice_number: "INV-1035" },
      version: 1,
      approver: { full_name: "Rəşad Əliyev" },
      approved_at: "2026-11-06T11:10:00Z",
      total: { amount: "3100.00", currency: "AZN" },
      valid: true,
      exported: false,
    });
    expect(d.recent_approvals.map((a) => a.package.invoice_number)).toEqual([
      "INV-1035",
      "INV-1036",
      "INV-1033",
      "INV-1031",
    ]);
  });
});
