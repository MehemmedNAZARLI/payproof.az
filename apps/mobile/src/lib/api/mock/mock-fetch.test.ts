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
