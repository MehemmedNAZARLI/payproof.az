import { mockIds } from "@payproof/mocks";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, expect, test } from "vitest";
import { setToken } from "@/lib/auth";
import { renderHookWithQuery, testQueryClient } from "@/test/render";
import { useMarkAllRead, useMarkRead, useNotifications } from "./queries";

beforeEach(() => setToken(`mock.${mockIds.user("u1")}`));

test("newest first with the unread count; reading one and then all clears it", async () => {
  const client = testQueryClient();
  const list = renderHookWithQuery(() => useNotifications(), client);
  await waitFor(() => expect(list.result.current.data).toBeDefined());
  const { items, unread_count } = list.result.current.data!;
  expect(unread_count).toBeGreaterThan(0);
  expect(items.map((n) => n.created_at)).toEqual(
    [...items.map((n) => n.created_at)].sort().reverse(),
  );
  const unread = items.find((n) => !n.read_at)!;
  const read = renderHookWithQuery(() => useMarkRead(), client).result;
  await act(() => read.current.mutateAsync(unread.id));
  await waitFor(() => expect(list.result.current.data!.unread_count).toBe(unread_count - 1));
  const all = renderHookWithQuery(() => useMarkAllRead(), client).result;
  await act(() => all.current.mutateAsync());
  await waitFor(() => expect(list.result.current.data!.unread_count).toBe(0));
});
