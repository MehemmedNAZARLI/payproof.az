import { unwrap, type Schemas } from "@payproof/api-client";
import { describe, expect, it } from "vitest";
import { as, pkgId } from "./api";
import { assertSchema } from "./contract";

describe("audit handlers", () => {
  it("package audit is newest first and conforms", async () => {
    const api = await as("u5");
    const res = await unwrap(
      api.GET("/v1/packages/{package_id}/audit", { params: { path: { package_id: pkgId(1036) } } }),
    );
    assertSchema("AuditPage", res);
    const times = res.items.map((e) => e.created_at);
    expect([...times].sort().reverse()).toEqual(times);
    expect(res.items.some((e) => e.action === "approval.invalidated" && e.actor === null)).toBe(
      true,
    );
  });

  it("company audit filters system events and searches text", async () => {
    const api = await as("u1");
    // 200 is JSON or CSV (format=csv); these calls are JSON
    const system = (await unwrap(
      api.GET("/v1/audit", { params: { query: { actor_id: "system" } } }),
    )) as Schemas["AuditPage"];
    expect(system.items.every((e) => e.actor === null)).toBe(true);
    const hit = (await unwrap(
      api.GET("/v1/audit", { params: { query: { q: "TS-5518_imzali_tam" } } }),
    )) as Schemas["AuditPage"];
    expect(hit.items.map((e) => e.package?.invoice_number)).toContain("INV-1036");
  });

  it("exports CSV", async () => {
    const api = await as("u1");
    const { data, response } = await api.GET("/v1/audit", {
      params: { query: { format: "csv", q: "INV-1033" } },
      parseAs: "text",
    });
    expect(response.headers.get("Content-Type")).toMatch(/^text\/csv/);
    expect(String(data).split("\n")[0]).toBe(
      "created_at,actor,action,invoice_number,package_version,message",
    );
    expect(String(data)).toContain('"INV-1033"');
  });
});
