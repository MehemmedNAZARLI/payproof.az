import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { createQueryClient } from "@/lib/query-client";
import { startSession } from "@/lib/session";
import { meFor, mockToken, notificationsOf } from "@/test/mock";

import {
  notificationKeys,
  readAllIn,
  readOneIn,
  unreadAgainIn,
  useMarkAllRead,
  useMarkRead,
  useUnreadCount,
} from "./queries";

const page = () => notificationsOf("u2");

function setup() {
  startSession({
    access_token: mockToken("u2"),
    token_type: "bearer",
    expires_in: 60,
    user: meFor("u2"),
  });
  const qc = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

describe("notification read state", () => {
  it("reads one unread notification and leaves read ones alone", async () => {
    const p = await page();
    const unread = p.items.find((n) => n.read_at === null)!;
    const next = readOneIn(p, unread.id);
    expect(next.unread_count).toBe(p.unread_count - 1);
    expect(next.items.find((n) => n.id === unread.id)!.read_at).not.toBeNull();
    expect(readOneIn(next, unread.id)).toBe(next);
    expect(readAllIn(p)).toMatchObject({ unread_count: 0 });
  });

  it("undoes only its own read, so an overlapping read that succeeded stays read", async () => {
    const p = await page();
    const [a, b] = p.items.filter((n) => n.read_at === null);
    const both = readOneIn(readOneIn(p, a!.id), b!.id);
    const undone = unreadAgainIn(both, [a!.id]);
    expect(undone.unread_count).toBe(p.unread_count - 1);
    expect(undone.items.find((n) => n.id === a!.id)!.read_at).toBeNull();
    expect(undone.items.find((n) => n.id === b!.id)!.read_at).not.toBeNull();
    // Nothing to undo when the item is gone or already unread again.
    expect(unreadAgainIn(undone, [a!.id, "missing"])).toBe(undone);
  });

  it("drops the badge the moment a notification is opened, and the server agrees", async () => {
    const { qc, wrapper } = setup();
    const { result } = renderHook(() => ({ count: useUnreadCount(), read: useMarkRead() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.count).toBe(2));
    const unread = (await page()).items.find((n) => n.read_at === null)!;
    act(() => result.current.read.mutate(unread.id));
    await waitFor(() => expect(result.current.count).toBe(1));
    await waitFor(() => expect(result.current.read.isSuccess).toBe(true));
    expect((await page()).unread_count).toBe(1);
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
    await waitFor(async () => expect((await page()).unread_count).toBe(0));
  });
});
