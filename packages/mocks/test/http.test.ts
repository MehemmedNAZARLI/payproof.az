import { describe, expect, it } from "vitest";
import { idempotent, json, page } from "../src/handlers/http";
import { createMockDb } from "../src/store";

describe("http plumbing", () => {
  it("pages with an opaque cursor", () => {
    const items = Array.from({ length: 5 }, (_, i) => i);
    const first = page(items, new URL("http://x/?limit=2"));
    expect(first).toEqual({ items: [0, 1], next_cursor: expect.any(String) });
    const last = page(items, new URL(`http://x/?limit=4&cursor=${first.next_cursor}`));
    expect(last).toEqual({ items: [2, 3, 4], next_cursor: null });
  });

  it("replays the stored response for the same key and body, rejects a reused key", async () => {
    const db = createMockDb();
    const req = () => new Request("http://x", { headers: { "Idempotency-Key": "k1" } });
    let runs = 0;
    const run = async () => (runs++, json({ n: runs }, 201));
    const a = await idempotent(db, req(), "approve:{v:4}", run);
    const b = await idempotent(db, req(), "approve:{v:4}", run);
    expect([a.status, await a.json(), b.status, await b.json()]).toEqual([
      201,
      { n: 1 },
      201,
      { n: 1 },
    ]);
    expect(runs).toBe(1);
    await expect(idempotent(db, req(), "approve:{v:5}", run)).rejects.toMatchObject({
      code: "IDEMPOTENCY_KEY_REUSED",
      status: 422,
    });
    await expect(idempotent(db, new Request("http://x"), "x", run)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("a second request while the first is still running → 409 IDEMPOTENCY_IN_PROGRESS", async () => {
    const db = createMockDb();
    const req = () => new Request("http://x", { headers: { "Idempotency-Key": "k2" } });
    let release!: () => void;
    const slow = () => new Promise<Response>((r) => (release = () => r(json({ ok: true }, 202))));
    const first = idempotent(db, req(), "f", slow);
    await expect(idempotent(db, req(), "f", slow)).rejects.toMatchObject({
      code: "IDEMPOTENCY_IN_PROGRESS",
      status: 409,
    });
    release();
    expect((await first).status).toBe(202);
  });

  it("a failed request frees the key for a retry", async () => {
    const db = createMockDb();
    const req = () => new Request("http://x", { headers: { "Idempotency-Key": "k3" } });
    await expect(
      idempotent(db, req(), "f", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect((await idempotent(db, req(), "f", async () => json({}, 200))).status).toBe(200);
  });
});
