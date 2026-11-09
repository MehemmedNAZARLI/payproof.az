import { afterEach, beforeEach, expect, test, vi } from "vitest";

// Fresh module per test: the in-memory token must not leak between cases.
const load = async () => {
  vi.resetModules();
  return import("./auth");
};

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

test("keeps the token in memory and sessionStorage", async () => {
  const auth = await load();
  expect(auth.getToken()).toBeNull();
  auth.setToken("mock.u1");
  expect(auth.getToken()).toBe("mock.u1");
  expect(sessionStorage.getItem("payproof.token")).toBe("mock.u1");
});

test("restores the token from sessionStorage after a reload", async () => {
  sessionStorage.setItem("payproof.token", "mock.u2");
  const auth = await load();
  expect(auth.getToken()).toBe("mock.u2");
});

test("clearing the token removes it everywhere", async () => {
  const auth = await load();
  auth.setToken("mock.u1");
  auth.setToken(null);
  expect(auth.getToken()).toBeNull();
  expect(sessionStorage.getItem("payproof.token")).toBeNull();
});

test("works in memory when sessionStorage throws", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  const auth = await load();
  expect(auth.getToken()).toBeNull();
  auth.setToken("mock.u3");
  expect(auth.getToken()).toBe("mock.u3");
});
