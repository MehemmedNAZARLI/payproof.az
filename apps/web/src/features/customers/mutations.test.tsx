import { unwrap } from "@payproof/api-client";
import { mockIds } from "@payproof/mocks";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, expect, test } from "vitest";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { renderHookWithQuery, testQueryClient } from "@/test/render";
import { useCreateRequirementSet, useRequirementHistory } from "./queries";

const C1 = mockIds.customer("c1"); // rule set v2
const C2 = mockIds.customer("c2"); // rule set v1; INV-1035 (approved) belongs here
beforeEach(() => setToken(`mock.${mockIds.user("u2")}`)); // approver

const change = (expected_version: number) => ({
  require_po: true,
  require_delivery: true,
  require_signature: false,
  tolerance: "0.02",
  effective_from: "2026-11-08",
  reason: "Müştəri imza tələbini ləğv etdi (məktub 07.11).",
  expected_version,
});

test("an approver saves a new version; history lists it first; existing approvals lapse", async () => {
  const client = testQueryClient();
  const history = renderHookWithQuery(() => useRequirementHistory(C2), client);
  await waitFor(() => expect(history.result.current.data).toBeDefined());
  const before = history.result.current.data!;
  const save = renderHookWithQuery(() => useCreateRequirementSet(C2), client).result;
  const created = await act(() => save.current.mutateAsync(change(before[0]!.version)));
  expect(created.version).toBe(before[0]!.version + 1);
  await waitFor(() => expect(history.result.current.data![0]!.version).toBe(created.version));
  // INV-1035 was approved under the old rules: it must be re-checked, not stay approved
  const pkg = await unwrap(
    api.GET("/v1/packages/{package_id}", {
      params: { path: { package_id: mockIds.pkg("pkg_1035") } },
    }),
  );
  expect(pkg.requirement_set.version).toBe(created.version);
  expect(pkg.status).not.toBe("APPROVED_READY");
});

test("an operator is refused; a stale version is a conflict", async () => {
  const save = renderHookWithQuery(() => useCreateRequirementSet(C1)).result;
  await expect(act(() => save.current.mutateAsync(change(1)))).rejects.toMatchObject({
    status: 409,
  });
  setToken(`mock.${mockIds.user("u1")}`);
  await expect(act(() => save.current.mutateAsync(change(2)))).rejects.toMatchObject({
    status: 403,
  });
});
