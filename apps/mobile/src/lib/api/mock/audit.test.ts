import { describe, expect, it } from "vitest";

import { createApiClient, type Schemas, unwrap } from "../client";
import { auditLog } from "./audit";
import { mockToken } from "./handlers";
import { createMockFetch } from "./mock-fetch";

// The endpoint also speaks CSV, so the client types the body as a page or a string.
const page = (body: Schemas["AuditPage"] | string) => {
  if (typeof body === "string") throw new Error("expected JSON");
  return body;
};

const api = createApiClient({
  baseUrl: "http://localhost:8000",
  getToken: () => mockToken("u2"),
  fetch: createMockFetch({ latencyMs: 0 }),
});

describe("mock audit log", () => {
  it("is newest first", () => {
    const times = auditLog.map((e) => e.created_at);
    expect(times).toEqual([...times].sort().reverse());
  });

  it("matches the contract's INV-1036 invalidation example", () => {
    const inv1036 = auditLog.filter((e) => e.package?.invoice_number === "INV-1036");
    expect(inv1036.slice(0, 2)).toMatchObject([
      {
        created_at: "2026-11-01T05:46:00Z",
        actor: null,
        action: "approval.invalidated",
        message:
          "v2 təsdiqi qüvvədən düşdü: təhvil sənədinin yeni versiyası yükləndi. Əvvəlki təsdiq auditdə saxlanılır.",
        package_version: 3,
        object_type: "approval",
      },
      {
        created_at: "2026-11-01T05:45:00Z",
        actor: { full_name: "Aygün Məmmədova" },
        action: "document.uploaded",
        message: "Təhvil sənədi: TS-5518_imzali_tam.pdf (sənəd v3)",
        object_type: "document_version",
      },
    ]);
  });

  it("ties approvals to the version they approved", () => {
    const v2 = auditLog.find(
      (e) => e.action === "package.approved" && e.package?.invoice_number === "INV-1036",
    );
    expect(v2).toMatchObject({ package_version: 2, object_type: "approval" });
  });

  it("never names an assignee as an actor (ADR-0008)", () => {
    expect(auditLog.every((e) => e.actor === null || e.actor.role !== "assignee")).toBe(true);
  });

  it("serves a limited page, optionally for one package", async () => {
    const first = page(await unwrap(api.GET("/v1/audit", { params: { query: { limit: 4 } } })));
    expect(first.items).toEqual(auditLog.slice(0, 4));
    const pkg = auditLog[0]?.package?.id ?? "";
    const one = page(
      await unwrap(api.GET("/v1/audit", { params: { query: { package_id: pkg } } })),
    );
    expect(one.items.every((e) => e.package?.id === pkg)).toBe(true);
  });
});
