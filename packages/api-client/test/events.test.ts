import { describe, expect, it, vi } from "vitest";
import { ApiError, subscribeEvents, type Schemas } from "../src";

const event = (n: number): Schemas["LiveEvent"] =>
  ({ event_id: `e${n}`, company_id: "c", type: "package.updated", package_id: "p" }) as never;
const frame = (e: Schemas["LiveEvent"]) =>
  `id: ${e.event_id}\nevent: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`;

/** A stream that yields `frames` and then ends (the server closed it) — or stays open. */
const sse = (frames: string[], { end = true } = {}) =>
  new Response(
    end
      ? frames.join("")
      : new ReadableStream({ start: (c) => c.enqueue(new TextEncoder().encode(frames.join(""))) }),
    { headers: { "Content-Type": "text/event-stream" } },
  );

const BASE = "http://api.test";
const retry = { minMs: 1, maxMs: 5 };

describe("subscribeEvents", () => {
  it("connects with the bearer token and delivers parsed events", async () => {
    const requests: Request[] = [];
    const fetch = vi.fn(
      async (r: Request) => (requests.push(r), sse([frame(event(1))], { end: false })),
    );
    const got: Schemas["LiveEvent"][] = [];
    const onOpen = vi.fn();
    const stop = subscribeEvents({
      baseUrl: "http://api.test",
      getToken: () => "t1",
      fetch,
      onOpen,
      onEvent: (e) => got.push(e),
    });
    await vi.waitFor(() => expect(got).toEqual([event(1)]));
    stop();
    expect(onOpen).toHaveBeenCalledOnce();
    expect(requests[0]!.url).toBe("http://api.test/v1/events");
    expect(requests[0]!.headers.get("Authorization")).toBe("Bearer t1");
    expect(requests[0]!.headers.get("Accept")).toBe("text/event-stream");
  });

  it("reconnects after the stream ends, sending Last-Event-ID, and opens again", async () => {
    const requests: Request[] = [];
    const fetch = vi.fn(async (r: Request) =>
      requests.push(r) === 1 ? sse([frame(event(1))]) : sse([], { end: false }),
    );
    const onOpen = vi.fn();
    const onError = vi.fn();
    const stop = subscribeEvents({
      baseUrl: BASE,
      fetch,
      retry,
      onOpen,
      onError,
      onEvent: () => {},
    });
    await vi.waitFor(() => expect(onOpen).toHaveBeenCalledTimes(2));
    stop();
    expect(requests[0]!.headers.get("Last-Event-ID")).toBeNull();
    expect(requests[1]!.headers.get("Last-Event-ID")).toBe("e1");
    expect(onError.mock.calls[0]![0]).toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("retries network failures with backoff", async () => {
    let calls = 0;
    const fetch = vi.fn(async () => {
      if (++calls < 3) throw new TypeError("offline");
      return sse([], { end: false });
    });
    const onOpen = vi.fn();
    const stop = subscribeEvents({ baseUrl: BASE, fetch, retry, onOpen, onEvent: () => {} });
    await vi.waitFor(() => expect(onOpen).toHaveBeenCalledOnce());
    stop();
    expect(calls).toBe(3);
  });

  it("a throwing onEvent does not drop the connection", async () => {
    const fetch = vi.fn(async () => sse([frame(event(1)), frame(event(2))], { end: false }));
    const got: string[] = [];
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const stop = subscribeEvents({
      baseUrl: BASE,
      fetch,
      retry,
      onEvent: (e) => {
        got.push(e.event_id);
        if (e.event_id === "e1") throw new Error("bug in a listener");
      },
    });
    await vi.waitFor(() => expect(got).toEqual(["e1", "e2"]));
    stop();
    expect(fetch).toHaveBeenCalledOnce();
    expect(quiet).toHaveBeenCalledOnce();
    quiet.mockRestore();
  });

  it("a 200 that is not an event stream (e.g. SPA HTML) is not an open connection", async () => {
    const fetch = vi.fn(async () => new Response("<!doctype html>", { status: 200 }));
    const onOpen = vi.fn();
    const onError = vi.fn();
    const stop = subscribeEvents({
      baseUrl: BASE,
      fetch,
      retry,
      onOpen,
      onError,
      onEvent: () => {},
    });
    await vi.waitFor(() => expect(fetch.mock.calls.length).toBeGreaterThan(1));
    stop();
    expect(onOpen).not.toHaveBeenCalled();
    expect(onError.mock.calls[0]![0]).toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("stops on 401 and reports UNAUTHENTICATED", async () => {
    const body = { error: { code: "UNAUTHENTICATED", message: "Sessiya bitib.", details: {} } };
    const fetch = vi.fn(async () => Response.json(body, { status: 401 }));
    const onError = vi.fn();
    subscribeEvents({ baseUrl: BASE, fetch, retry, onError, onEvent: () => {} });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
    await new Promise((r) => setTimeout(r, 20));
    expect(fetch).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0]![0]).toBeInstanceOf(ApiError);
    expect(onError.mock.calls[0]![0]).toMatchObject({ code: "UNAUTHENTICATED", status: 401 });
  });

  it("stop() (or the caller's signal) ends the subscription without reconnecting", async () => {
    const fetch = vi.fn(async (r: Request) => {
      const res = sse([], { end: false });
      r.signal.addEventListener("abort", () => void res.body?.cancel().catch(() => {}));
      return res;
    });
    const abort = new AbortController();
    const onError = vi.fn();
    subscribeEvents({
      baseUrl: BASE,
      fetch,
      retry,
      onError,
      onEvent: () => {},
      signal: abort.signal,
    });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    abort.abort();
    await new Promise((r) => setTimeout(r, 20));
    expect(fetch).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
  });
});
