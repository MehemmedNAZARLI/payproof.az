import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearPersistedQueries, persistQueries, restoreQueries } from "./query-persist";

const KEY = "payproof.cache";
const detail = ["packages", "detail", "p1"] as const;

function seeded() {
  const qc = new QueryClient();
  qc.setQueryData(detail, { id: "p1" });
  qc.setQueryData(["dashboard"], { package_count: 14 });
  qc.setQueryData(["document-file", "v1"], { url: "https://signed.example/x" });
  qc.setQueryData(["auth", "dev-users"], [{ id: "u1" }]);
  return qc;
}

describe("offline read cache", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("restores what this user last viewed, after a relaunch", () => {
    const stop = persistQueries(seeded(), () => "u2");
    vi.advanceTimersByTime(1000);
    stop();
    const fresh = new QueryClient();
    restoreQueries(fresh, "u2");
    expect(fresh.getQueryData(detail)).toEqual({ id: "p1" });
    expect(fresh.getQueryData(["dashboard"])).toEqual({ package_count: 14 });
  });

  it("never stores signed file links or another screen's demo user list", () => {
    persistQueries(seeded(), () => "u2")();
    const raw = localStorage.getItem(KEY) ?? "";
    expect(raw).not.toContain("signed.example");
    expect(raw).not.toContain("dev-users");
  });

  it("gives nothing to a different user", () => {
    persistQueries(seeded(), () => "u2")();
    const other = new QueryClient();
    restoreQueries(other, "u1");
    expect(other.getQueryData(detail)).toBeUndefined();
  });

  it("forgets data older than a day", () => {
    persistQueries(seeded(), () => "u2")();
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);
    const fresh = new QueryClient();
    restoreQueries(fresh, "u2");
    expect(fresh.getQueryData(detail)).toBeUndefined();
  });

  it("writes nothing without a session and drops everything on clear", () => {
    persistQueries(seeded(), () => undefined)();
    expect(localStorage.getItem(KEY)).toBeNull();
    persistQueries(seeded(), () => "u2")();
    clearPersistedQueries();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("follows later updates, batched", () => {
    const qc = seeded();
    const stop = persistQueries(qc, () => "u2");
    qc.setQueryData(["dashboard"], { package_count: 15 });
    expect(localStorage.getItem(KEY)).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(localStorage.getItem(KEY)).toContain('"package_count":15');
    stop();
  });

  it("survives storage that is full or blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(() => persistQueries(seeded(), () => "u2")()).not.toThrow();
    vi.restoreAllMocks();
  });
});
