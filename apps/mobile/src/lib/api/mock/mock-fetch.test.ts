import expected from "@fixtures/expected.json";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, createApiClient, unwrap } from "../client";
import { mockToken } from "./handlers";
import { createMockFetch } from "./mock-fetch";
import { resetSessionDb } from "./session-db";

const apiAs = (token: string | null = mockToken("u2")) =>
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
  it("requires a session", async () => {
    expect(await fail(unwrap(apiAs(null).GET("/v1/me")))).toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
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

describe("mock dev login", () => {
  it("lists the three demo accounts without a session", async () => {
    const { items } = await unwrap(apiAs(null).GET("/v1/auth/dev-users"));
    expect(items.map((u) => [u.full_name, u.role])).toEqual([
      ["Aygün Məmmədova", "operator"],
      ["Rəşad Əliyev", "approver"],
      ["Kamran Babayev", "readonly"],
    ]);
  });

  it("issues a session whose token serves that user", async () => {
    const [, rashad] = (await unwrap(apiAs(null).GET("/v1/auth/dev-users"))).items;
    const session = await unwrap(
      apiAs(null).POST("/v1/auth/dev-login", { body: { user_id: rashad?.id ?? "" } }),
    );
    expect(session).toMatchObject({ token_type: "bearer", expires_in: 28800 });
    expect(session.user).toMatchObject({ full_name: "Rəşad Əliyev", role: "approver" });
    expect(session.user.permissions).toContain("APPROVE_PACKAGE");
    const me = await unwrap(apiAs(session.access_token).GET("/v1/me"));
    expect(me).toEqual(session.user);
  });

  it("refuses users who cannot sign in and malformed bodies", async () => {
    const elvin = "0193a000-0000-7000-8000-000000000003";
    const login = (body: unknown) =>
      fail(unwrap(apiAs(null).POST("/v1/auth/dev-login", { body: body as { user_id: string } })));
    expect(await login({ user_id: elvin })).toMatchObject({ status: 404, code: "NOT_FOUND" });
    expect(await login({ user: 1 })).toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });
});

describe("mock GET /v1/dashboard", () => {
  it("serves the dashboard to a signed-in user only", async () => {
    const d = await unwrap(apiAs().GET("/v1/dashboard"));
    expect(d.status_counts.READY_FOR_APPROVAL).toBe(statusCount("READY_FOR_APPROVAL"));
    expect(await fail(unwrap(apiAs(null).GET("/v1/dashboard")))).toMatchObject({ status: 401 });
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

describe("mock GET /v1/packages/{id}", () => {
  const INV_1038 = "0193a000-0000-7000-8002-000000001038";

  it("returns the detail with permissions for the signed-in user", async () => {
    const get = (token: string) =>
      unwrap(
        apiAs(token).GET("/v1/packages/{package_id}", {
          params: { path: { package_id: INV_1038 } },
        }),
      );
    expect((await get(mockToken("u2"))).permissions.can_approve).toBe(true);
    expect((await get(mockToken("u1"))).permissions.can_approve).toBe(false);
  });

  it("answers 404 for an unknown package and 401 without a session", async () => {
    const get = (token: string | null, id: string) =>
      fail(
        unwrap(
          apiAs(token).GET("/v1/packages/{package_id}", { params: { path: { package_id: id } } }),
        ),
      );
    expect(await get(mockToken("u2"), "0193a000-0000-7000-8002-000000009999")).toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
    expect(await get(null, INV_1038)).toMatchObject({ status: 401 });
  });
});

describe("mock GET /v1/documents/versions/{id}/file", () => {
  const version = "0193a000-0000-7000-8005-000010420001";
  afterEach(() => vi.useRealTimers());

  it("links to the version as mock paper, valid for five minutes", async () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 10, 8, 6, 30), toFake: ["Date"] });
    const link = await unwrap(
      apiAs().GET("/v1/documents/versions/{version_id}/file", {
        params: { path: { version_id: version } },
      }),
    );
    expect(link).toEqual({
      url: `mock:paper/${version}`,
      expires_at: "2026-11-08T06:35:00Z",
    });
  });

  it("answers 404 for an unknown version", async () => {
    expect(
      await fail(
        unwrap(
          apiAs().GET("/v1/documents/versions/{version_id}/file", {
            params: { path: { version_id: "0193a000-0000-7000-8005-000099990001" } },
          }),
        ),
      ),
    ).toMatchObject({ status: 404 });
  });
});

describe("mock POST /v1/packages/{id}/approve", () => {
  afterEach(resetSessionDb);

  it("approves through the client and the list shows it", async () => {
    const api = apiAs();
    const ready = await unwrap(
      api.GET("/v1/packages", { params: { query: { status: ["READY_FOR_APPROVAL"] } } }),
    );
    const pkg = await unwrap(
      api.GET("/v1/packages/{package_id}", {
        params: { path: { package_id: ready.items[0]!.id } },
      }),
    );
    const approval = await unwrap(
      api.POST("/v1/packages/{package_id}/approve", {
        params: {
          path: { package_id: pkg.id },
          header: { "Idempotency-Key": crypto.randomUUID() },
        },
        body: {
          expected_version: pkg.version,
          expected_requirement_set_version: pkg.requirement_set.version,
          documents_reviewed: true,
        },
      }),
    );
    expect(approval.package_version).toBe(pkg.version);
    const after = await unwrap(
      api.GET("/v1/packages", { params: { query: { status: ["READY_FOR_APPROVAL"] } } }),
    );
    expect(after.items.map((p) => p.id)).not.toContain(pkg.id);
  });

  it("requires a session and answers an unknown package with 404", async () => {
    const call = (token: string | null, headers: Record<string, string>) =>
      createMockFetch({ latencyMs: 0 })(
        new Request("http://localhost:8000/v1/packages/x/approve", {
          method: "POST",
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
          body: "{}",
        }),
      );
    expect((await call(null, {})).status).toBe(401);
    expect((await call(mockToken("u2"), {})).status).toBe(404);
  });
});
