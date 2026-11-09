import { unwrap } from "@payproof/api-client";
import { mockIds } from "@payproof/mocks";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { packageKeys } from "@/features/packages";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { renderHookWithQuery, testQueryClient } from "@/test/render";
import { useConfirmMatch, useDeletePackage, useValidate } from "./mutations";
import { usePackage } from "./queries";

beforeEach(() => setToken(`mock.${mockIds.user("u1")}`));
const PKG = mockIds.pkg("pkg_1042");

const loaded = async () => {
  const client = testQueryClient();
  const detail = renderHookWithQuery(() => usePackage(PKG), client);
  await waitFor(() => expect(detail.result.current.data).toBeDefined());
  return { client, pkg: detail.result.current.data! };
};

test("INV-1042: confirming the suggested order bumps the version, re-validates → NEEDS_FIX", async () => {
  const { client, pkg } = await loaded();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const { result } = renderHookWithQuery(() => useConfirmMatch(PKG), client);
  const next = await act(() =>
    result.current.mutateAsync({
      order_id: pkg.link.candidates[0]!.order_id,
      expected_version: pkg.version,
    }),
  );
  expect(next.version).toBe(pkg.version + 1);
  expect(next.link.confirmed).toBe(true);
  expect(next.status).toBe("NEEDS_FIX");
  expect(client.getQueryData(packageKeys.detail(PKG))).toEqual(next); // the screen updates at once
  // lists and audit refresh; the detail just written is not fetched again
  const call = invalidate.mock.calls.find(([f]) => f?.queryKey === packageKeys.all)![0]!;
  expect(call.predicate!({ queryKey: packageKeys.list({}) } as never)).toBe(true);
  expect(call.predicate!({ queryKey: packageKeys.detail(PKG) } as never)).toBe(false);
});

test("a stale version gets 409 and the detail is refetched", async () => {
  const { client, pkg } = await loaded();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const { result } = renderHookWithQuery(() => useValidate(PKG), client);
  await act(() =>
    result.current.mutateAsync({ expected_version: pkg.version + 5 }).catch(() => {}),
  );
  expect(result.current.error).toMatchObject({ status: 409, code: "VERSION_CONFLICT" });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: packageKeys.detail(PKG) });
});

test("delete: a never-approved package goes; an approved one is refused", async () => {
  const { client, pkg } = await loaded();
  const { result } = renderHookWithQuery(() => useDeletePackage(PKG), client);
  await act(() => result.current.mutateAsync({ expected_version: pkg.version }));
  expect(client.getQueryData(packageKeys.detail(PKG))).toBeUndefined(); // gone from the cache
  const id = mockIds.pkg("pkg_1033"); // exported: kept for good
  const { version } = await unwrap(
    api.GET("/v1/packages/{package_id}", { params: { path: { package_id: id } } }),
  );
  const exported = renderHookWithQuery(() => useDeletePackage(id), client);
  await expect(
    act(() => exported.result.current.mutateAsync({ expected_version: version })),
  ).rejects.toMatchObject({ code: "PACKAGE_NOT_DELETABLE" });
});
