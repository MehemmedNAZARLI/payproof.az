import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { packageDetailKeys } from "@/features/package-detail/queries";
import { packageKeys } from "@/features/packages/queries";
import { unwrap } from "@/lib/api";
import { detailOf, mockClient, pkgId, signInAs } from "@/test/mock";

import { type LiveEvent, onLiveEvent, useLiveUpdates } from "./live";

// The real stream: subscribeEvents → the in-page mock's GET /v1/events (no stubs).
describe("live updates over the mock's event stream", () => {
  it("delivers another user's approval and refreshes what it changed", async () => {
    await signInAs("u1"); // Aygün, who owns the package
    const qc = new QueryClient();
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    const heard: LiveEvent[] = [];
    const off = onLiveEvent((e) => heard.push(e));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const view = renderHook(() => useLiveUpdates(), { wrapper });

    const id = pkgId("pkg_1038");
    const pkg = await detailOf(id);
    // Give the stream a moment to connect before the write.
    await new Promise((r) => setTimeout(r, 20));
    await unwrap(
      mockClient("u2").POST("/v1/packages/{package_id}/approve", {
        params: { path: { package_id: id }, header: { "Idempotency-Key": crypto.randomUUID() } },
        body: {
          expected_version: pkg.version,
          expected_requirement_set_version: pkg.requirement_set.version,
          documents_reviewed: true,
        },
      }),
    );

    await waitFor(() => expect(heard.map((e) => e.type)).toContain("package.approved"));
    const approved = heard.find((e) => e.type === "package.approved")!;
    expect(approved).toMatchObject({ package_id: id, package_version: pkg.version });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: packageKeys.lists() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: packageDetailKeys.detail(id) });
    await waitFor(() => expect(heard.map((e) => e.type)).toContain("notification.created"));
    off();
    view.unmount();
  });
});
