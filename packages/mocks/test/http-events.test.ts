import { unwrap } from "@payproof/api-client";
import { afterEach, describe, expect, it } from "vitest";
import { tokenFor } from "../src/handlers/http";
import { id } from "../src/ids";
import { as, BASE, mock, pkgId } from "./api";

const aborts: AbortController[] = [];
afterEach(() => aborts.splice(0).forEach((a) => a.abort()));

/** Opens the stream as `user`; `until(text)` resolves with everything read once `text` appears. */
async function open(user = "u1", token = tokenFor(id.user(user))) {
  const abort = new AbortController();
  aborts.push(abort);
  const res = await fetch(`${BASE}/v1/events`, {
    headers: { Authorization: `Bearer ${token}`, "Last-Event-ID": "x" },
    signal: abort.signal,
  });
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let text = "";
  const until = async (needle: string | RegExp) => {
    while (typeof needle === "string" ? !text.includes(needle) : !needle.test(text)) {
      const { value, done } = await reader.read();
      if (done) throw new Error(`stream ended without ${needle}: ${text}`);
      text += value;
    }
    return text;
  };
  return { res, until };
}

describe("GET /v1/events (mock SSE)", () => {
  it("streams a write as id/event/data frames", async () => {
    const { res, until } = await open();
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    await until(": connected");
    await unwrap(
      (await as("u1")).POST("/v1/packages/{package_id}/validate", {
        params: { path: { package_id: pkgId(1042) } },
        body: { expected_version: 1 },
      }),
    );
    const text = await until(/id: (\S+)\nevent: package\.updated\ndata: (.+)\n\n/);
    const [, eventId, json] = /id: (\S+)\nevent: package\.updated\ndata: (.+)\n\n/.exec(text)!;
    const data = JSON.parse(json!);
    expect(data.event_id).toBe(eventId);
    expect(data).toMatchObject({ package_id: pkgId(1042), actor_id: id.user("u1") });
  });

  it("sends heartbeats", async () => {
    const { until } = await open();
    await until(": ping");
  });

  it("never streams another company's event", async () => {
    const { until } = await open();
    await until(": connected");
    const base = { package_id: null, package_version: null, actor_id: null, at: "x" } as const;
    mock.events.emit({ ...base, event_id: "other", company_id: "c-other", type: "task.changed" });
    mock.events.emit({ ...base, event_id: "ours", company_id: id.company(), type: "task.changed" });
    expect(await until("id: ours")).not.toContain("id: other");
  });

  it("rejects a missing or bad token with 401", async () => {
    const res = await fetch(`${BASE}/v1/events`, { headers: { Authorization: "Bearer nope" } });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
  });
});
