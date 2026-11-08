import { afterEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/components/ui/toast-store";

import { ApiError } from "./api/client";
import { createQueryClient, errorMessage, shouldRetry } from "./query-client";

const forbidden = new ApiError("FORBIDDEN", "İcazə yoxdur.", 403);
const offline = new ApiError("NETWORK_ERROR", "İnternet bağlantısı yoxdur.", 0);

describe("shouldRetry", () => {
  it("does not retry client errors", () => {
    expect(shouldRetry(0, forbidden)).toBe(false);
  });

  it("retries network and server errors a couple of times", () => {
    expect(shouldRetry(0, offline)).toBe(true);
    expect(shouldRetry(1, new ApiError("INTERNAL_ERROR", "x", 500))).toBe(true);
    expect(shouldRetry(2, offline)).toBe(false);
  });
});

describe("errorMessage", () => {
  it("shows the server's Azerbaijani message, never a raw exception", () => {
    expect(errorMessage(forbidden)).toBe("İcazə yoxdur.");
    expect(errorMessage(new TypeError("x is undefined"))).toMatch(/^Gözlənilməz xəta/);
  });
});

describe("createQueryClient error toasts", () => {
  afterEach(() => vi.restoreAllMocks());
  const fail = () => Promise.reject(forbidden);

  it("stays quiet when a first load fails (the screen shows the error)", async () => {
    const spy = vi.spyOn(toast, "error");
    await createQueryClient()
      .fetchQuery({ queryKey: ["x"], queryFn: fail })
      .catch(() => {});
    expect(spy).not.toHaveBeenCalled();
  });

  it("toasts when a refresh fails over cached data", async () => {
    const spy = vi.spyOn(toast, "error");
    const client = createQueryClient();
    client.setQueryData(["x"], { ok: true });
    await client.fetchQuery({ queryKey: ["x"], queryFn: fail, staleTime: 0 }).catch(() => {});
    expect(spy).toHaveBeenCalledWith("Məlumat yenilənmədi", "İcazə yoxdur.");
    expect(client.getQueryData(["x"])).toEqual({ ok: true });
  });

  it("toasts failed mutations unless the screen handles them", async () => {
    const spy = vi.spyOn(toast, "error");
    const client = createQueryClient();
    const run = (silentError: boolean) =>
      client
        .getMutationCache()
        .build(client, { mutationFn: fail, meta: { silentError } })
        .execute(undefined)
        .catch(() => {});
    await run(true);
    expect(spy).not.toHaveBeenCalled();
    await run(false);
    expect(spy).toHaveBeenCalledWith("İcazə yoxdur.");
  });
});
