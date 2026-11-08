import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/lib/query-client";

import { useMe } from "./auth/queries";
import { packageKeys, usePackages } from "./packages/queries";

// The real in-page mock, without its artificial latency.
vi.mock("@/lib/api/mock/mock-fetch", async (load) => {
  const real = await load<typeof import("@/lib/api/mock/mock-fetch")>();
  return { createMockFetch: () => real.createMockFetch({ latencyMs: 0 }) };
});

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>;
}

describe("useMe", () => {
  it("loads the signed-in user from the mock API", async () => {
    const { result } = renderHook(() => useMe(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ full_name: "Rəşad Əliyev", role: "approver" });
  });
});

describe("usePackages", () => {
  it("loads all packages", async () => {
    const { result } = renderHook(() => usePackages(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.total_count).toBe(14);
  });

  it("passes filters to the API", async () => {
    const { result } = renderHook(() => usePackages({ status: ["READY_FOR_APPROVAL"] }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items.every((p) => p.status === "READY_FOR_APPROVAL")).toBe(true);
  });

  it("keys each filter combination separately under one invalidation root", () => {
    expect(packageKeys.list({ q: "1038" })).toEqual(["packages", "list", { q: "1038" }]);
    expect(packageKeys.list({ q: "1038" }).slice(0, 2)).toEqual(packageKeys.lists());
  });
});
