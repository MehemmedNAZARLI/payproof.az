import { unwrap } from "@payproof/api-client";
import { describe, expect, it } from "vitest";
import { as, pkgId } from "./api";
import { assertSchema } from "./contract";

describe("read handlers", () => {
  it("dashboard conforms", async () => {
    const api = await as("u1");
    assertSchema("Dashboard", await unwrap(api.GET("/v1/dashboard")));
  });

  it("lists packages filtered by several statuses, sorted by problem age", async () => {
    const api = await as("u1");
    const page = await unwrap(
      api.GET("/v1/packages", {
        params: {
          query: { status: ["NEEDS_FIX", "NEEDS_REVIEW"], sort: "-problem_age", limit: 3 },
        },
      }),
    );
    assertSchema("PackagePage", page);
    expect(page.total_count).toBe(8);
    expect(page.items).toHaveLength(3);
    expect(page.items[0]!.invoice_number).toBe("INV-1042");
    expect(page.next_cursor).not.toBeNull();
  });

  it("filters by issue and search text", async () => {
    const api = await as("u1");
    const byIssue = await unwrap(
      api.GET("/v1/packages", { params: { query: { issue: "R-005" } } }),
    );
    expect(byIssue.items.map((p) => p.invoice_number)).toEqual(["INV-1044"]);
    const byText = await unwrap(api.GET("/v1/packages", { params: { query: { q: "ts-5541" } } }));
    expect(byText.items.map((p) => p.invoice_number)).toEqual(["INV-1048"]);
  });

  it("package detail, candidates; unknown id → 404", async () => {
    const api = await as("u1");
    const opts = { params: { path: { package_id: pkgId(1048) } } };
    assertSchema("PackageDetail", await unwrap(api.GET("/v1/packages/{package_id}", opts)));
    const cands = await unwrap(api.GET("/v1/packages/{package_id}/match-candidates", opts));
    expect(cands.items.map((c) => c.po_number)).toEqual(["PO-383", "PO-384"]);
    await expect(
      api.GET("/v1/packages/{package_id}", { params: { path: { package_id: pkgId(9999) } } }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });
});
