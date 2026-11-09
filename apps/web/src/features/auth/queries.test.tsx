import { mockIds } from "@payproof/mocks";
import { act, waitFor } from "@testing-library/react";
import { expect, test } from "vitest";
import { getToken, setToken } from "@/lib/auth";
import { renderHookWithQuery } from "@/test/render";
import { authKeys, useCan, useDevLogin, useDevUsers, useMe } from "./queries";

const AYGUN = mockIds.user("u1");
const RASHAD = mockIds.user("u2");

test("dev users come from the API", async () => {
  const { result } = renderHookWithQuery(() => useDevUsers());
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.map((u) => u.full_name)).toContain("Aygün Məmmədova");
});

test("dev login stores the token and primes /v1/me", async () => {
  const { result, client } = renderHookWithQuery(() => useDevLogin());
  await act(() => result.current.mutateAsync(RASHAD));
  expect(getToken()).toMatch(/^mock\./);
  expect(client.getQueryData(authKeys.me())).toMatchObject({ full_name: "Rəşad Əliyev" });
});

test("useMe answers in mock mode once signed in", async () => {
  const login = renderHookWithQuery(() => useDevLogin());
  await act(() => login.result.current.mutateAsync(AYGUN));
  const { result } = renderHookWithQuery(() => useMe());
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toMatchObject({ role: "operator", company: { voen: "1700123451" } });
});

test("useMe without a token fails with 401", async () => {
  setToken(null);
  const { result } = renderHookWithQuery(() => useMe());
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error).toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
});

test("useCan reads permissions from /v1/me, not from the role", async () => {
  const login = renderHookWithQuery(() => useDevLogin());
  await act(() => login.result.current.mutateAsync(AYGUN));
  const { result } = renderHookWithQuery(() => ({
    approve: useCan("APPROVE_PACKAGE"),
    edit: useCan("EDIT_PACKAGE"),
  }));
  await waitFor(() => expect(result.current.edit).toBe(true));
  expect(result.current.approve).toBe(false);
});

test("signing in as another user drops the previous user's cached data", async () => {
  const { result, client } = renderHookWithQuery(() => useDevLogin());
  client.setQueryData(["packages", "list"], ["A-nın paketi"]);
  await act(() => result.current.mutateAsync(RASHAD));
  expect(client.getQueryData(["packages", "list"])).toBeUndefined();
  expect(client.getQueryData(authKeys.me())).toMatchObject({ full_name: "Rəşad Əliyev" });
});
