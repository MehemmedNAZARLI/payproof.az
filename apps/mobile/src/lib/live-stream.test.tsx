import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/components/ui/toast-store";
import { packageDetailKeys } from "@/features/package-detail/queries";
import { packageKeys } from "@/features/packages/queries";
import { unwrap } from "@/lib/api";
import { type DemoUser, detailOf, mockClient, pkgId, signInAs } from "@/test/mock";

import { type LiveEvent, onLiveEvent, useLiveUpdates } from "./live";
import { useLiveToasts } from "./live-toasts";

// The real stream: subscribeEvents → the in-page mock's GET /v1/events (no stubs).

const id = pkgId("pkg_1038");

async function watchAs(user: DemoUser) {
  await signInAs(user);
  const qc = new QueryClient();
  const invalidate = vi.spyOn(qc, "invalidateQueries");
  const heard: LiveEvent[] = [];
  const off = onLiveEvent((e) => heard.push(e));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const view = renderHook(
    () => {
      useLiveUpdates();
      useLiveToasts();
    },
    { wrapper },
  );
  const pkg = await detailOf(id);
  qc.setQueryData(packageDetailKeys.detail(id), pkg);
  // Give the stream a moment to connect before the write.
  await new Promise((r) => setTimeout(r, 20));
  return { qc, invalidate, heard, pkg, done: () => (off(), view.unmount()) };
}

const approveAsRashad = (pkg: Awaited<ReturnType<typeof detailOf>>) =>
  unwrap(
    mockClient("u2").POST("/v1/packages/{package_id}/approve", {
      params: { path: { package_id: id }, header: { "Idempotency-Key": crypto.randomUUID() } },
      body: {
        expected_version: pkg.version,
        expected_requirement_set_version: pkg.requirement_set.version,
        documents_reviewed: true,
      },
    }),
  );

describe("live updates over the mock's event stream", () => {
  afterEach(() => vi.restoreAllMocks());

  it("delivers another user's approval, refreshes what it changed and says who did it", async () => {
    const info = vi.spyOn(toast, "info");
    const w = await watchAs("u1"); // Aygün, who owns the package
    await approveAsRashad(w.pkg);

    await waitFor(() => expect(w.heard.map((e) => e.type)).toContain("package.approved"));
    expect(w.heard.find((e) => e.type === "package.approved")).toMatchObject({
      package_id: id,
      package_version: w.pkg.version,
    });
    expect(w.invalidate).toHaveBeenCalledWith({ queryKey: packageKeys.lists() });
    expect(w.invalidate).toHaveBeenCalledWith({ queryKey: packageDetailKeys.detail(id) });
    await waitFor(() =>
      expect(info).toHaveBeenCalledWith("Rəşad Əliyev INV-1038 package approved (v1)"),
    );
    w.done();
  });

  it("refreshes but shows no toast for the user's own change", async () => {
    const info = vi.spyOn(toast, "info");
    const w = await watchAs("u2");
    await approveAsRashad(w.pkg);
    await waitFor(() => expect(w.heard.map((e) => e.type)).toContain("package.approved"));
    expect(w.invalidate).toHaveBeenCalledWith({ queryKey: packageKeys.lists() });
    await new Promise((r) => setTimeout(r, 20));
    expect(info).not.toHaveBeenCalled();
    w.done();
  });
});
