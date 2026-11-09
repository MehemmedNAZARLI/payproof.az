import { ApiError, type Schemas, type SubscribeEventsOptions } from "@payproof/api-client";
import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { authKeys } from "@/features/auth";
import { packageKeys } from "@/features/packages";
import { renderHookWithQuery, testQueryClient } from "@/test/render";
import { onLiveEvent, useLiveUpdates } from "./live";

const sub = vi.hoisted(() => ({
  options: undefined as SubscribeEventsOptions | undefined,
  stop: vi.fn(),
}));
vi.mock("@payproof/api-client", async (original) => ({
  ...(await original<typeof import("@payproof/api-client")>()),
  subscribeEvents: (options: SubscribeEventsOptions) => {
    sub.options = options;
    return sub.stop;
  },
}));
beforeEach(() => sub.stop.mockClear());

const event = (type: string): Schemas["LiveEvent"] => ({
  event_id: "e1",
  company_id: "c1",
  type: type as Schemas["LiveEventType"],
  package_id: "p1",
  package_version: 2,
  actor_id: "u2",
  at: "2026-11-08T09:12:00Z",
});

const setup = () => {
  const client = testQueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const view = renderHookWithQuery(() => useLiveUpdates(), client);
  return { invalidate, view };
};

test("subscribes once with the API base URL and the session token", () => {
  setup();
  expect(sub.options?.baseUrl).toBe("http://localhost:8000");
  expect(typeof sub.options?.getToken).toBe("function");
});

test("an event invalidates its keys and reaches live listeners", () => {
  const { invalidate } = setup();
  const seen = vi.fn();
  const off = onLiveEvent(seen);
  act(() => sub.options!.onEvent(event("package.approved")));
  expect(invalidate).toHaveBeenCalledWith({ queryKey: packageKeys.all });
  expect(seen).toHaveBeenCalledWith(expect.objectContaining({ type: "package.approved" }));
  off();
});

test("first connect refetches nothing; a reconnect refetches everything (events may be missed)", () => {
  const { invalidate } = setup();
  act(() => sub.options!.onOpen!());
  expect(invalidate).not.toHaveBeenCalled();
  act(() => sub.options!.onOpen!());
  expect(invalidate).toHaveBeenCalledWith();
});

test("an unknown event type invalidates everything", () => {
  const { invalidate } = setup();
  act(() => sub.options!.onEvent(event("package.renamed")));
  expect(invalidate).toHaveBeenCalledWith();
});

test("unmount (sign-out, 401 → login) stops the stream", () => {
  const { view } = setup();
  view.unmount();
  expect(sub.stop).toHaveBeenCalledOnce();
});

describe("fallback polling while the stream is down", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const lost = new ApiError("NETWORK_ERROR", "x", 0);

  test("polls active queries every 30 s, stops once the stream is back (which refetches all)", () => {
    const client = testQueryClient();
    const refetch = vi.spyOn(client, "refetchQueries");
    const invalidate = vi.spyOn(client, "invalidateQueries");
    renderHookWithQuery(() => useLiveUpdates(), client);
    act(() => sub.options!.onOpen!());

    act(() => sub.options!.onError!(lost));
    act(() => sub.options!.onError!(lost)); // retries report again: still one timer
    vi.advanceTimersByTime(29_999);
    expect(refetch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refetch).toHaveBeenCalledWith({ type: "active" });
    vi.advanceTimersByTime(30_000);
    expect(refetch).toHaveBeenCalledTimes(2);

    act(() => sub.options!.onOpen!());
    expect(invalidate).toHaveBeenCalledWith(); // reconnect: full refetch (itself a refetchQueries call)
    const afterReconnect = refetch.mock.calls.length;
    vi.advanceTimersByTime(90_000);
    expect(refetch).toHaveBeenCalledTimes(afterReconnect); // polling stopped
  });

  test("a 401 does not start polling (the app signs out instead)", () => {
    const client = testQueryClient();
    const refetch = vi.spyOn(client, "refetchQueries");
    renderHookWithQuery(() => useLiveUpdates(), client);
    act(() => sub.options!.onError!(new ApiError("UNAUTHENTICATED", "x", 401)));
    vi.advanceTimersByTime(60_000);
    expect(refetch).not.toHaveBeenCalledWith({ type: "active" }); // (the session re-check may refetch `me`)
  });

  test("unmount clears the polling timer", () => {
    const client = testQueryClient();
    const refetch = vi.spyOn(client, "refetchQueries");
    const view = renderHookWithQuery(() => useLiveUpdates(), client);
    act(() => sub.options!.onError!(lost));
    view.unmount();
    vi.advanceTimersByTime(60_000);
    expect(refetch).not.toHaveBeenCalled();
  });
});

test("a failed first connect counts as offline: the later open refetches everything", () => {
  const client = testQueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  renderHookWithQuery(() => useLiveUpdates(), client);
  act(() => sub.options!.onError!(new ApiError("NETWORK_ERROR", "x", 0)));
  act(() => sub.options!.onOpen!());
  expect(invalidate).toHaveBeenCalledWith();
});

test("a 401 on the stream rechecks the session, so the app signs out like on any 401", () => {
  const client = testQueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  renderHookWithQuery(() => useLiveUpdates(), client);
  act(() => sub.options!.onError!(new ApiError("UNAUTHENTICATED", "x", 401)));
  expect(invalidate).toHaveBeenCalledWith({ queryKey: authKeys.me() });
});
