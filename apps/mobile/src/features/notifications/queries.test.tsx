import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockToken } from "@/lib/api/mock/handlers";
import { notificationPage } from "@/lib/api/mock/notifications";
import { resetSessionDb } from "@/lib/api/mock/session-db";
import { meFor } from "@/lib/api/mock/store";
import { createQueryClient } from "@/lib/query-client";
import { startSession } from "@/lib/session";

import {
  notificationKeys,
  readAllIn,
  readOneIn,
  useMarkAllRead,
  useMarkRead,
  useUnreadCount,
} from "./queries";

vi.mock("@/lib/api/mock/mock-fetch", async (load) => {
  const real = await load<typeof import("@/lib/api/mock/mock-fetch")>();
  return { createMockFetch: () => real.createMockFetch({ latencyMs: 0 }) };
});

const page = () => notificationPage("u2", false, 100);

function setup() {
  startSession({
    access_token: mockToken("u2"),
    token_type: "bearer",
    expires_in: 60,
    user: meFor("u2")!,
  });
  const qc = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

describe("notification read state", () => {
  beforeEach(resetSessionDb);

  it("reads one unread notification and leaves read ones alone", () => {
    const p = page();
    const unread = p.items.find((n) => n.read_at === null)!;
    const next = readOneIn(p, unread.id);
    expect(next.unread_count).toBe(p.unread_count - 1);
    expect(next.items.find((n) => n.id === unread.id)!.read_at).not.toBeNull();
    expect(readOneIn(next, unread.id)).toBe(next);
    expect(readAllIn(p)).toMatchObject({ unread_count: 0 });
  });

  it("drops the badge the moment a notification is opened, and the server agrees", async () => {
    const { qc, wrapper } = setup();
    const { result } = renderHook(() => ({ count: useUnreadCount(), read: useMarkRead() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.count).toBe(2));
    const unread = page().items.find((n) => n.read_at === null)!;
    act(() => result.current.read.mutate(unread.id));
    await waitFor(() => expect(result.current.count).toBe(1));
    await waitFor(() => expect(result.current.read.isSuccess).toBe(true));
    expect(page().unread_count).toBe(1);
    expect(qc.getQueryData(notificationKeys.list())).toMatchObject({ unread_count: 1 });
  });

  it("reads everything at once", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => ({ count: useUnreadCount(), all: useMarkAllRead() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.count).toBe(2));
    act(() => result.current.all.mutate(undefined));
    await waitFor(() => expect(result.current.count).toBe(0));
    await waitFor(() => expect(page().unread_count).toBe(0));
  });
});
