import { mockIds } from "@payproof/mocks";
import { waitFor } from "@testing-library/react";
import { beforeEach, expect, test } from "vitest";
import { useCustomers } from "@/features/customers";
import { useAssignableUsers } from "@/features/users";
import { setToken } from "@/lib/auth";
import { renderHookWithQuery } from "@/test/render";
import { usePackageList } from "./queries";

beforeEach(() => setToken(`mock.${mockIds.user("u1")}`));

const list = async (params: Parameters<typeof usePackageList>[0]) => {
  const { result } = renderHookWithQuery(() => usePackageList(params));
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  return result.current.data!;
};

test("unfiltered: all 14 demo packages", async () => {
  expect((await list({})).total_count).toBe(14);
});

test("status filter (KPI link) and search", async () => {
  const fix = await list({ status: ["NEEDS_FIX"] });
  expect(fix.total_count).toBe(4);
  expect(fix.items.every((p) => p.status === "NEEDS_FIX")).toBe(true);
  expect((await list({ q: "INV-1042" })).items.map((p) => p.invoice_number)).toEqual(["INV-1042"]);
});

test("filter options: customers and possible owners (no read-only users)", async () => {
  const customers = renderHookWithQuery(() => useCustomers());
  const owners = renderHookWithQuery(() => useAssignableUsers());
  await waitFor(() => expect(customers.result.current.data).toHaveLength(2));
  await waitFor(() => expect(owners.result.current.isSuccess).toBe(true));
  expect(owners.result.current.data!.some((u) => u.role === "readonly")).toBe(false);
});
