import { ApiError, type SubscribeEventsOptions } from "@payproof/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { packageKeys } from "@/features/packages/queries";
import { endSession, getSession, startSession } from "@/lib/session";
import { meFor, mockToken } from "@/test/mock";

import { type LiveEvent, onLiveEvent, useLiveUpdates, usePackageChangedSince } from "./live";

// Each subscribeEvents call is one connection; the test drives its callbacks.
const wire = vi.hoisted(() => ({
  connections: [] as { options: SubscribeEventsOptions; stopped: boolean }[],
}));
vi.mock("@payproof/api-client", async (load) => ({
  ...(await load<typeof import("@payproof/api-client")>()),
  subscribeEvents: (options: SubscribeEventsOptions) => {
    const connection = { options, stopped: false };
    wire.connections.push(connection);
    return () => void (connection.stopped = true);
  },
}));
const last = () => wire.connections.at(-1)!;
const open = () => wire.connections.filter((c) => !c.stopped);

const event = {
  event_id: "0193a000-0000-7000-800a-000000000099",
  company_id: "0193a000-0000-7000-8000-00000000c0a1",
  type: "package.updated",
  package_id: "0193a000-0000-7000-8002-000000001038",
  package_version: 2,
  actor_id: null,
  at: "2026-11-08T07:00:00Z",
} satisfies LiveEvent;

function setVisible(visible: boolean) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => (visible ? "visible" : "hidden"),
  });
  act(() => void document.dispatchEvent(new Event("visibilitychange")));
}
function setOnline(online: boolean) {
  vi.stubGlobal("navigator", { ...navigator, onLine: online });
  act(() => void window.dispatchEvent(new Event(online ? "online" : "offline")));
}

function mount() {
  const qc = new QueryClient();
  const invalidate = vi.spyOn(qc, "invalidateQueries");
  const refetch = vi.spyOn(qc, "refetchQueries").mockResolvedValue();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const view = renderHook(() => useLiveUpdates(), { wrapper });
  return { invalidate, refetch, ...view };
}

beforeEach(() => {
  wire.connections.length = 0;
  setVisible(true);
  startSession({
    access_token: mockToken("u2"),
    token_type: "bearer",
    expires_in: 600,
    user: meFor("u2"),
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useLiveUpdates", () => {
  it("connects once while signed in, with the session token", () => {
    mount();
    expect(open()).toHaveLength(1);
    expect(last().options.getToken?.()).toBe(mockToken("u2"));
  });

  it("does not connect without a session, and stops on sign-out", () => {
    endSession("user");
    mount();
    expect(open()).toHaveLength(0);
    act(
      () =>
        void startSession({
          access_token: mockToken("u2"),
          token_type: "bearer",
          expires_in: 600,
          user: meFor("u2"),
        }),
    );
    expect(open()).toHaveLength(1);
    act(() => endSession("user"));
    expect(open()).toHaveLength(0);
  });

  it("invalidates what an event changes and tells the listeners", () => {
    const { invalidate } = mount();
    const heard = vi.fn();
    const off = onLiveEvent(heard);
    act(() => last().options.onOpen?.());
    // events may have been missed before the stream opened, the first time too
    expect(invalidate).toHaveBeenCalledWith();
    invalidate.mockClear();
    act(() => last().options.onEvent(event));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: packageKeys.lists() });
    expect(heard).toHaveBeenCalledWith(event);
    off();
  });

  it("closes in the background and refetches everything when back in front", () => {
    const { invalidate } = mount();
    act(() => last().options.onOpen?.());
    setVisible(false);
    expect(open()).toHaveLength(0);
    setVisible(true);
    expect(open()).toHaveLength(1);
    act(() => last().options.onOpen?.());
    expect(invalidate).toHaveBeenCalledWith();
  });

  it("does not connect offline, and reconnects when the network is back", () => {
    setOnline(false);
    mount();
    expect(open()).toHaveLength(0);
    setOnline(true);
    expect(open()).toHaveLength(1);
  });

  it("polls active queries every 30 s while the stream is down, and stops once it is back", () => {
    vi.useFakeTimers();
    const { refetch, invalidate } = mount();
    const polls = () => refetch.mock.calls;
    act(() => last().options.onError?.(new ApiError("NETWORK_ERROR", "x", 0)));
    act(() => void vi.advanceTimersByTime(30_000));
    expect(polls()).toHaveLength(1);
    act(() => void vi.advanceTimersByTime(30_000));
    expect(polls()).toHaveLength(2);
    act(() => last().options.onOpen?.());
    expect(invalidate).toHaveBeenCalledWith(); // events may have been missed while down
    const afterOpen = polls().length; // invalidateQueries refetches through refetchQueries too
    act(() => void vi.advanceTimersByTime(90_000));
    expect(polls()).toHaveLength(afterOpen);
  });

  it("ends the session when the stream's token is rejected", () => {
    mount();
    act(() => last().options.onError?.(new ApiError("UNAUTHENTICATED", "x", 401)));
    expect(getSession()).toBeNull();
    expect(open()).toHaveLength(0);
  });
});

describe("usePackageChangedSince", () => {
  function watch() {
    const qc = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    return renderHook(
      () => {
        useLiveUpdates();
        return usePackageChangedSince(event.package_id, 1);
      },
      { wrapper },
    );
  }
  const send = (e: Partial<LiveEvent>) => act(() => last().options.onEvent({ ...event, ...e }));

  it("ignores the user's own changes and older versions", () => {
    const { result } = watch();
    send({ actor_id: meFor("u2").id, package_version: 2 });
    send({ actor_id: meFor("u1").id, package_version: 1 });
    expect(result.current).toBeNull();
  });

  it("names a newer version by someone else, or by the system", () => {
    const { result } = watch();
    send({ actor_id: meFor("u1").id, package_version: 2 });
    expect(result.current).toEqual({ version: 2, bySystem: false });
    send({ actor_id: null, package_version: 3 });
    expect(result.current).toEqual({ version: 3, bySystem: true });
  });
});
