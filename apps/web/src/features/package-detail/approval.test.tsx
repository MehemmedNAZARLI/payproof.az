import { unwrap } from "@payproof/api-client";
import { mockIds } from "@payproof/mocks";
import { act } from "@testing-library/react";
import { beforeEach, expect, test } from "vitest";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { renderHookWithQuery, testQueryClient } from "@/test/render";
import { exportDownload, internalReport, useApprove, useExport } from "./approval";

const RESAD = `mock.${mockIds.user("u2")}`;
const AYGUN = `mock.${mockIds.user("u1")}`;
beforeEach(() => setToken(RESAD));
const detail = (key: string) =>
  unwrap(
    api.GET("/v1/packages/{package_id}", { params: { path: { package_id: mockIds.pkg(key) } } }),
  );
const intent = (pkg: Awaited<ReturnType<typeof detail>>) => ({
  expected_version: pkg.version,
  expected_requirement_set_version: pkg.requirement_set.version,
  idempotencyKey: crypto.randomUUID(),
});

test("approve the current version → APPROVED_READY; repeating creates no second approval", async () => {
  const pkg = await detail("pkg_1038");
  const client = testQueryClient();
  const { result } = renderHookWithQuery(() => useApprove(pkg.id), client);
  const first = await act(() => result.current.mutateAsync(intent(pkg)));
  expect(first.package_version).toBe(pkg.version);
  const again = await act(() => result.current.mutateAsync(intent(pkg)));
  expect(again.id).toBe(first.id); // idempotent: same approval, no new event
  expect((await detail("pkg_1038")).status).toBe("APPROVED_READY");
});

test("approving a stale version is a VERSION_CONFLICT; an operator is refused", async () => {
  const pkg = await detail("pkg_1036");
  const { result } = renderHookWithQuery(() => useApprove(pkg.id));
  await expect(
    act(() => result.current.mutateAsync({ ...intent(pkg), expected_version: pkg.version - 1 })),
  ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  setToken(AYGUN);
  await expect(act(() => result.current.mutateAsync(intent(pkg)))).rejects.toMatchObject({
    status: 403,
  });
});

test("export the approved package with the invoice; a fresh link later creates no event", async () => {
  const pkg = await detail("pkg_1035");
  const { result } = renderHookWithQuery(() => useExport(pkg.id));
  const invoice = pkg.documents.find((d) => d.type === "invoice")!.current.id;
  const done = await act(() =>
    result.current.mutateAsync({ ...intent(pkg), document_version_ids: [invoice] }),
  );
  expect(done.export.files.map((f) => f.type)).toEqual(["invoice"]);
  expect((await detail("pkg_1035")).status).toBe("EXPORTED");
  const link = await exportDownload(done.export.id);
  expect(link.url).toMatch(/\.zip$/);
  expect((await detail("pkg_1035")).exports).toHaveLength(1);
});

test("internal report of the current version", async () => {
  const report = await internalReport(mockIds.pkg("pkg_1044"));
  expect(report.status).toBe("NEEDS_FIX");
  expect(report.checks.some((c) => c.rule_id === "R-005")).toBe(true);
});
