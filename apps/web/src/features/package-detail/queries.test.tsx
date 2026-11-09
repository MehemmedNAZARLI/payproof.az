import { mockIds } from "@payproof/mocks";
import { waitFor } from "@testing-library/react";
import { beforeEach, expect, test } from "vitest";
import { usePackageList } from "@/features/packages";
import { setToken } from "@/lib/auth";
import { renderHookWithQuery } from "@/test/render";
import { usePackage, usePackageAudit } from "./queries";

beforeEach(() => setToken(`mock.${mockIds.user("u1")}`));

test("every demo package's detail and audit load", async () => {
  const list = renderHookWithQuery(() => usePackageList({}));
  await waitFor(() => expect(list.result.current.data?.items).toHaveLength(14));
  for (const { id, status } of list.result.current.data!.items) {
    const detail = renderHookWithQuery(() => usePackage(id));
    const audit = renderHookWithQuery(() => usePackageAudit(id));
    await waitFor(() =>
      expect(detail.result.current.isSuccess && audit.result.current.isSuccess).toBe(true),
    );
    expect(detail.result.current.data).toMatchObject({ id, status });
    expect(Array.isArray(audit.result.current.data)).toBe(true);
  }
});

test("an unknown package is a 404, not a crash", async () => {
  const { result } = renderHookWithQuery(() => usePackage("0193a000-0000-7000-8002-000000009999"));
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error).toMatchObject({ status: 404 });
});
