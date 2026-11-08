import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/lib/query-client";
import { getSession, signOutReason, startSession } from "@/lib/session";

import { useSignOut } from "./queries";

afterEach(() => vi.unstubAllGlobals());

describe("useSignOut", () => {
  it("ends the session and clears the Query cache and the runtime caches", async () => {
    const remove = vi.fn(() => Promise.resolve(true));
    vi.stubGlobal("caches", { keys: () => Promise.resolve(["pages"]), delete: remove });
    const client = createQueryClient();
    client.setQueryData(["packages", "list", {}], { items: [] });
    startSession({
      access_token: "mock.u2",
      token_type: "bearer",
      expires_in: 60,
      user: {} as never,
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSignOut(), { wrapper });

    await act(() => result.current());

    expect(getSession()).toBeNull();
    expect(signOutReason()).toBe("user");
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(remove).toHaveBeenCalledWith("pages");
  });
});
