import { describe, expect, it } from "vitest";
import { expectTypeOf } from "vitest";
import { ApiError, createApiClient, toFormData, unwrap, type Schemas } from "../src";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function setup(
  respond: (req: Request) => Response | Promise<Response>,
  token: string | null = "t0k",
) {
  const seen: Request[] = [];
  const client = createApiClient({
    baseUrl: "http://api.test",
    getToken: () => token,
    fetch: async (input: Request) => {
      seen.push(input);
      return respond(input);
    },
  });
  return { client, seen };
}

describe("createApiClient", () => {
  it("serializes array query params as the contract says (form, explode: false)", async () => {
    const { client, seen } = setup(() =>
      json(200, { items: [], next_cursor: null, total_count: 0 }),
    );
    await client.GET("/v1/packages", {
      params: { query: { status: ["NEEDS_FIX", "NEEDS_REVIEW"] } },
    });
    expect(new URL(seen[0]!.url).searchParams.getAll("status")).toEqual(["NEEDS_FIX,NEEDS_REVIEW"]);
  });

  it("sends the bearer token and returns data on success", async () => {
    const { client, seen } = setup(() => json(200, { items: [] }));
    const { data } = await client.GET("/v1/customers");
    expect(data).toEqual({ items: [] });
    expect(seen[0]!.url).toBe("http://api.test/v1/customers");
    expect(seen[0]!.headers.get("Authorization")).toBe("Bearer t0k");
  });

  it("omits Authorization when there is no token", async () => {
    const { client, seen } = setup(() => json(200, { items: [] }), null);
    await client.GET("/v1/auth/dev-users");
    expect(seen[0]!.headers.has("Authorization")).toBe(false);
  });

  it("throws ApiError with the contract error code, message and status", async () => {
    const body = {
      error: {
        code: "VERSION_CONFLICT",
        message: "Paket v3-ə yenilənib; səhifəni yeniləyin.",
        details: { current_version: 3 },
      },
    };
    const { client } = setup(() => json(409, body));
    const err = await client
      .POST("/v1/packages/{package_id}/validate", {
        params: { path: { package_id: "0193a000-0000-7000-8002-000000001042" } },
        body: { expected_version: 2 },
      })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      code: "VERSION_CONFLICT",
      status: 409,
      message: body.error.message,
      details: { current_version: 3 },
    });
  });

  it("maps a non-JSON error response to INTERNAL_ERROR", async () => {
    const { client } = setup(() => new Response("<html>Bad gateway</html>", { status: 502 }));
    await expect(client.GET("/v1/me")).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      status: 502,
    });
  });

  it("maps a network failure to NETWORK_ERROR", async () => {
    const { client } = setup(() => {
      throw new TypeError("fetch failed");
    });
    const err = await client.GET("/v1/me").catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "NETWORK_ERROR", status: 0 });
    expect((err as Error).cause).toBeInstanceOf(TypeError);
  });

  it("lets an aborted request reject with the AbortError (query cancellation is not an outage)", async () => {
    const { client } = setup(
      (req) =>
        new Promise((_, reject) => {
          if (req.signal.aborted) reject(req.signal.reason);
          req.signal.addEventListener("abort", () => reject(req.signal.reason));
        }),
    );
    const ctrl = new AbortController();
    const pending = client.GET("/v1/me", { signal: ctrl.signal }).catch((e: unknown) => e);
    ctrl.abort();
    const err = await pending;
    expect(err).not.toBeInstanceOf(ApiError);
    expect((err as Error).name).toBe("AbortError");
  });

  it("unwrap resolves to non-optional data (TanStack Query queryFn)", async () => {
    const { client } = setup(() => json(200, { items: [] }));
    const data = await unwrap(client.GET("/v1/customers"));
    expectTypeOf(data).toEqualTypeOf<{ items: Schemas["Customer"][] }>();
    expect(data).toEqual({ items: [] });
  });

  it("unwrap propagates ApiError", async () => {
    const { client } = setup(() =>
      json(403, { error: { code: "FORBIDDEN", message: "Səlahiyyət yoxdur.", details: {} } }),
    );
    await expect(unwrap(client.GET("/v1/me"))).rejects.toBeInstanceOf(ApiError);
  });

  it("uploads a Blob as multipart/form-data with the Idempotency-Key", async () => {
    const { client, seen } = setup(() =>
      json(202, { job_id: "0193a000-0000-7000-8007-000010420002" }),
    );
    const file = new File(["%PDF-1.7"], "INV-1042_v2_PO-381.pdf", { type: "application/pdf" });
    await client.POST("/v1/packages/{package_id}/documents", {
      params: {
        path: { package_id: "0193a000-0000-7000-8002-000000001042" },
        header: { "Idempotency-Key": "6f1d2c3b-4a5e-4f60-9a7b-8c9d0e1f2a3b" },
      },
      body: { type: "invoice", file, expected_version: 2 },
      bodySerializer: toFormData,
    });
    const req = seen[0]!;
    expect(req.headers.get("Content-Type")).toMatch(/^multipart\/form-data; boundary=/);
    expect(req.headers.get("Idempotency-Key")).toBe("6f1d2c3b-4a5e-4f60-9a7b-8c9d0e1f2a3b");
    const form = await req.formData();
    expect(form.get("type")).toBe("invoice");
    expect(form.get("expected_version")).toBe("2");
    expect((form.get("file") as File).name).toBe("INV-1042_v2_PO-381.pdf");
  });

  it("uses globalThis.fetch at request time (MSW in node patches it after the client exists)", async () => {
    const client = createApiClient({ baseUrl: "http://api.test" });
    const original = globalThis.fetch;
    globalThis.fetch = (async () => json(200, { items: [] })) as typeof fetch;
    try {
      const { data } = await client.GET("/v1/customers");
      expect(data).toEqual({ items: [] });
    } finally {
      globalThis.fetch = original;
    }
  });
});
