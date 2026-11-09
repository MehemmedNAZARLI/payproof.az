import { mockIds } from "@payproof/mocks";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, expect, test } from "vitest";
import { setToken } from "@/lib/auth";
import { renderHookWithQuery, testQueryClient } from "@/test/render";
import { useCorrectField } from "./mutations";
import { usePackage } from "./queries";

beforeEach(() => setToken(`mock.${mockIds.user("u1")}`));

const loaded = async (key: string) => {
  const client = testQueryClient();
  const detail = renderHookWithQuery(() => usePackage(mockIds.pkg(key)), client);
  await waitFor(() => expect(detail.result.current.data).toBeDefined());
  return { client, pkg: detail.result.current.data! };
};

test("INV-1047: correcting the unreadable PO from the source makes the package ready", async () => {
  const { client, pkg } = await loaded("pkg_1047");
  const po = pkg.fields.find((f) => f.field_path === "invoice.po_ref")!;
  expect(po.review_status).toBe("REVIEW_REQUIRED"); // scan reads "PO-3?7"; the linked order is PO-397
  const { result } = renderHookWithQuery(() => useCorrectField(pkg.id), client);
  const next = await act(() =>
    result.current.mutateAsync({
      fieldId: po.id,
      value: "PO-397",
      reason: "Skanda 7 aydın görünür",
      expected_version: pkg.version,
    }),
  );
  expect(next.status).toBe("READY_FOR_APPROVAL");
  expect(next.fields.find((f) => f.id === po.id)).toMatchObject({
    value: "PO-397",
    review_status: "CORRECTED",
  });
});
