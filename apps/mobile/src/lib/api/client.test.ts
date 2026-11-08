import { describe, expect, it } from "vitest";

import { ApiError, createApiClient, unwrap } from "./client";

const BASE = "http://api.test";
const json = (body: unknown, status = 200) => Response.json(body, { status });

function clientWith(
  respond: (req: Request) => Response | Promise<Response>,
  token: string | null = null,
) {
  const seen: Request[] = [];
  const api = createApiClient({
    baseUrl: BASE,
    getToken: () => token,
    fetch: async (input) => {
      const req = input instanceof Request ? input : new Request(input);
      seen.push(req);
      return respond(req);
    },
  });
  return { api, seen };
}

describe("createApiClient", () => {
  it("sends the bearer token when there is a session", async () => {
    const { api, seen } = clientWith(() => json({}), "tok-1");
    await api.GET("/v1/me");
    expect(seen[0]?.headers.get("Authorization")).toBe("Bearer tok-1");
  });

  it("sends array query parameters comma-separated, as the contract specifies", async () => {
    const { api, seen } = clientWith(() => json({ items: [], next_cursor: null, total_count: 0 }));
    await api.GET("/v1/packages", { params: { query: { status: ["NEEDS_FIX", "NEEDS_REVIEW"] } } });
    expect(new URL(seen[0]?.url ?? "").searchParams.getAll("status")).toEqual([
      "NEEDS_FIX,NEEDS_REVIEW",
    ]);
  });

  it("sends no Authorization header without a session", async () => {
    const { api, seen } = clientWith(() => json({}));
    await api.GET("/v1/me");
    expect(seen[0]?.headers.has("Authorization")).toBe(false);
  });
});

describe("unwrap", () => {
  it("returns the typed body of a successful response", async () => {
    const { api } = clientWith(() => json({ items: [], next_cursor: null, total_count: 0 }));
    const page = await unwrap(api.GET("/v1/packages"));
    expect(page.total_count).toBe(0);
  });

  it("turns the contract error body into an ApiError", async () => {
    const body = {
      error: { code: "FORBIDDEN", message: "İcazə yoxdur.", details: { role: "operator" } },
    };
    const { api } = clientWith(() => json(body, 403));
    const error = await unwrap(api.GET("/v1/me")).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: "FORBIDDEN",
      message: "İcazə yoxdur.",
      status: 403,
      details: { role: "operator" },
    });
  });

  it("gives a safe Azerbaijani message when the body is not a contract error", async () => {
    const { api } = clientWith(() => new Response("<html>Bad gateway</html>", { status: 502 }));
    const error = await unwrap(api.GET("/v1/me")).catch((e: unknown) => e);
    expect(error).toMatchObject({
      code: "INTERNAL_ERROR",
      status: 502,
      message: "Gözlənilməz xəta baş verdi. Bir az sonra yenidən cəhd edin.",
    });
  });

  it("reports a failed connection as NETWORK_ERROR", async () => {
    const { api } = clientWith(() => {
      throw new TypeError("Failed to fetch");
    });
    const error = await unwrap(api.GET("/v1/me")).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "NETWORK_ERROR", status: 0 });
  });

  it("lets cancellations through untouched", async () => {
    const { api } = clientWith(() => {
      throw new DOMException("aborted", "AbortError");
    });
    const error = await unwrap(api.GET("/v1/me")).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DOMException);
  });
});
