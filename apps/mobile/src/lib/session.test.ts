import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Schemas } from "./api";

const user = {
  id: "0193a000-0000-7000-8000-000000000002",
  email: "rashad.aliyev@a-distribusiya.test",
  full_name: "Rəşad Əliyev",
  title: "Finance director",
  role: "approver",
  company: {
    id: "0193a000-0000-7000-8000-00000000c0a1",
    name: "A Distribusiya MMC",
    voen: "1700123451",
  },
  permissions: ["VIEW", "APPROVE_PACKAGE"],
} satisfies Schemas["Me"];
const issued = { access_token: "mock.u2", token_type: "bearer", expires_in: 60, user } as const;

// A fresh module per test is a fresh page load: the session must come back from storage.
const load = () => import("./session");

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe("session", () => {
  it("starts signed out", async () => {
    const s = await load();
    expect(s.getSession()).toBeNull();
    expect(s.getToken()).toBeNull();
  });

  it("keeps the token and user across a reload", async () => {
    (await load()).startSession(issued);
    const reloaded = await load();
    expect(reloaded.getToken()).toBe("mock.u2");
    expect(reloaded.getSession()?.user.full_name).toBe("Rəşad Əliyev");
  });

  it("returns the same snapshot until the session changes", async () => {
    const s = await load();
    s.startSession(issued);
    expect(s.getSession()).toBe(s.getSession());
  });

  it("notifies subscribers and remembers why the session ended", async () => {
    const s = await load();
    const listener = vi.fn();
    const unsubscribe = s.subscribeSession(listener);
    s.startSession(issued);
    s.endSession("expired");
    expect(listener).toHaveBeenCalledTimes(2);
    expect(s.getSession()).toBeNull();
    expect(s.signOutReason()).toBe("expired");
    expect(localStorage.length).toBe(0);
    unsubscribe();
  });

  it("treats an expired token as signed out", async () => {
    vi.useFakeTimers({ now: Date.parse("2026-11-08T10:00:00Z") });
    (await load()).startSession(issued);
    vi.setSystemTime(Date.parse("2026-11-08T10:01:01Z"));
    expect((await load()).getSession()).toBeNull();
  });

  it("ignores unreadable or foreign storage values", async () => {
    localStorage.setItem("payproof.session", "{not json");
    expect((await load()).getSession()).toBeNull();
    vi.resetModules();
    localStorage.setItem("payproof.session", JSON.stringify({ token: 42 }));
    expect((await load()).getSession()).toBeNull();
  });

  it("follows a sign-out in another tab", async () => {
    const s = await load();
    s.startSession(issued);
    const listener = vi.fn();
    s.subscribeSession(listener);
    localStorage.removeItem("payproof.session");
    window.dispatchEvent(new StorageEvent("storage", { key: "payproof.session" }));
    expect(listener).toHaveBeenCalled();
    expect(s.getSession()).toBeNull();
  });

  it("ends itself when the token expires, so screens move on to the login", async () => {
    vi.useFakeTimers({ now: Date.parse("2026-11-08T10:00:00Z") });
    const s = await load();
    s.startSession(issued);
    const listener = vi.fn();
    s.subscribeSession(listener);
    vi.advanceTimersByTime(60_000);
    expect(listener).toHaveBeenCalled();
    expect(s.signOutReason()).toBe("expired");
    expect(localStorage.length).toBe(0);
  });

  it("still knows a session was stored after it expired, so a 401 can end it", async () => {
    vi.useFakeTimers({ now: Date.parse("2026-11-08T10:00:00Z") });
    (await load()).startSession(issued);
    vi.setSystemTime(Date.parse("2026-11-08T11:00:00Z"));
    const s = await load();
    expect(s.getSession()).toBeNull();
    expect(s.hasStoredSession()).toBe(true);
  });

  it("treats a sign-out in another tab as the user's", async () => {
    const s = await load();
    s.startSession(issued);
    s.subscribeSession(() => {});
    localStorage.removeItem("payproof.session");
    window.dispatchEvent(new StorageEvent("storage", { key: "payproof.session" }));
    expect(s.signOutReason()).toBe("user");
  });

  it("reports when a signed-in user is replaced, not when someone signs in", async () => {
    const s = await load();
    const changed = vi.fn();
    s.watchUserChange(changed);
    s.startSession(issued);
    expect(changed).not.toHaveBeenCalled();
    s.startSession({ ...issued, access_token: "mock.u1" });
    expect(changed).toHaveBeenCalledTimes(1);
    s.endSession("user");
    expect(changed).toHaveBeenCalledTimes(2);
  });
});
