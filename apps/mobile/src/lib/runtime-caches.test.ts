import { afterEach, describe, expect, it, vi } from "vitest";

import { clearRuntimeCaches } from "./runtime-caches";

afterEach(() => vi.unstubAllGlobals());

describe("clearRuntimeCaches", () => {
  it("deletes runtime caches and keeps the app-shell precache", async () => {
    const names = ["serwist-precache-v2-http://localhost/", "pages", "pages-rsc", "others"];
    const remove = vi.fn((name: string) => Promise.resolve(names.includes(name)));
    vi.stubGlobal("caches", { keys: () => Promise.resolve(names), delete: remove });
    await clearRuntimeCaches();
    expect(remove.mock.calls.map(([n]) => n)).toEqual(["pages", "pages-rsc", "others"]);
  });

  it("does nothing where Cache Storage is missing or blocked", async () => {
    await expect(clearRuntimeCaches()).resolves.toBeUndefined();
    vi.stubGlobal("caches", { keys: () => Promise.reject(new DOMException("blocked")) });
    await expect(clearRuntimeCaches()).resolves.toBeUndefined();
  });
});
