import expected from "@fixtures/expected.json";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, createApiClient, unwrap } from "../client";
import { mockToken } from "./handlers";
import { createMockFetch } from "./mock-fetch";

const apiAs = (token: string | null = null) =>
  createApiClient({
    baseUrl: "http://localhost:8000",
    getToken: () => token,
    fetch: createMockFetch({ latencyMs: 0 }),
  });
const statusCount = (...s: string[]) =>
  Object.values(expected.packages).filter((p) => s.includes(p.status)).length;
const fail = (p: Promise<unknown>) =>
  p.then(
    () => undefined,
    (e: unknown) => e,
  );

describe("mock GET /v1/me", () => {
  it("serves the default demo approver until sign-in exists", async () => {
    expect(await unwrap(apiAs().GET("/v1/me"))).toMatchObject({
      full_name: "Rəşad Əliyev",
      role: "approver",
    });
  });

  it("resolves the user from a mock bearer token", async () => {
    expect(await unwrap(apiAs(mockToken("u1")).GET("/v1/me"))).toMatchObject({ role: "operator" });
  });

  it("rejects tokens of users who cannot sign in, and unknown tokens", async () => {
    for (const token of [mockToken("u3"), "garbage"]) {
      expect(await fail(unwrap(apiAs(token).GET("/v1/me")))).toMatchObject({
        status: 401,
        code: "UNAUTHENTICATED",
      });
    }
  });
});

describe("mock GET /v1/packages", () => {
  it("lists all packages, most recently updated first", async () => {
    const page = await unwrap(apiAs().GET("/v1/packages"));
    expect(page.total_count).toBe(14);
    const times = page.items.map((p) => p.updated_at);
    expect(times).toEqual([...times].sort().reverse());
  });

  it("filters by several statuses", async () => {
    const page = await unwrap(
      apiAs().GET("/v1/packages", { params: { query: { status: ["NEEDS_FIX", "NEEDS_REVIEW"] } } }),
    );
    expect(page.total_count).toBe(statusCount("NEEDS_FIX", "NEEDS_REVIEW"));
    expect(page.items.every((p) => p.status === "NEEDS_FIX" || p.status === "NEEDS_REVIEW")).toBe(
      true,
    );
  });

  it("searches invoice number and customer name, case-insensitively", async () => {
    const byCustomer = await unwrap(
      apiAs().GET("/v1/packages", { params: { query: { q: "restoran" } } }),
    );
    expect(byCustomer.items.length).toBeGreaterThan(0);
    expect(byCustomer.items.every((p) => p.customer.name === "C Restoran Qrupu")).toBe(true);
    const byInvoice = await unwrap(
      apiAs().GET("/v1/packages", { params: { query: { q: "inv-1038" } } }),
    );
    expect(byInvoice.items.map((p) => p.invoice_number)).toEqual(["INV-1038"]);
  });

  it("sorts by any contract key, e.g. invoice number ascending", async () => {
    const page = await unwrap(
      apiAs().GET("/v1/packages", { params: { query: { sort: "invoice_number", q: "INV" } } }),
    );
    const numbers = page.items.map((p) => p.invoice_number ?? "");
    expect(numbers).toEqual([...numbers].sort());
  });

  it("pages with an opaque cursor", async () => {
    const api = apiAs();
    const first = await unwrap(api.GET("/v1/packages", { params: { query: { limit: 10 } } }));
    expect(first.items).toHaveLength(10);
    expect(first.next_cursor).not.toBeNull();
    const cursor = first.next_cursor ?? undefined;
    const second = await unwrap(
      api.GET("/v1/packages", { params: { query: { limit: 10, cursor } } }),
    );
    expect(second.items).toHaveLength(4);
    expect(second.next_cursor).toBeNull();
    expect(new Set([...first.items, ...second.items].map((p) => p.id)).size).toBe(14);
  });

  it("refuses filters it does not implement yet rather than ignoring them", async () => {
    const error = await fail(
      unwrap(apiAs().GET("/v1/packages", { params: { query: { from: "2026-11-01" } } })),
    );
    expect(error).toMatchObject({ status: 422, details: { param: "from" } });
  });

  it("rejects an unknown status with a validation error", async () => {
    const error = await fail(
      unwrap(
        apiAs().GET("/v1/packages", { params: { query: { status: ["PAID" as "EXPORTED"] } } }),
      ),
    );
    expect(error).toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });
});

describe("createMockFetch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("answers unknown endpoints with a contract 404", async () => {
    const res = await createMockFetch({ latencyMs: 0 })(
      new Request("http://localhost:8000/v1/nope"),
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("fails like the network does while the device is offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const error = await fail(unwrap(apiAs().GET("/v1/me")));
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "NETWORK_ERROR" });
  });
});
