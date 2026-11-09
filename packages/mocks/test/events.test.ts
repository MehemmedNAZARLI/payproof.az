import { unwrap } from "@payproof/api-client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LiveEvent } from "../src/events";
import { eventType } from "../src/events";
import { id } from "../src/ids";
import { as, mock, pkgId } from "./api";
import { assertSchema } from "./contract";

const KEY = (k: string) => `00000000-0000-4000-8000-${k.padStart(12, "0")}`;
const approve = (api: Awaited<ReturnType<typeof as>>, key: string, v = 1) =>
  api.POST("/v1/packages/{package_id}/approve", {
    params: { path: { package_id: pkgId(1038) }, header: { "Idempotency-Key": KEY(key) } },
    body: { expected_version: v, expected_requirement_set_version: 2, documents_reviewed: true },
  });

let seen: LiveEvent[] = [];
let stop = () => {};
afterEach(() => stop());
const record = () => {
  seen = [];
  stop = mock.events.subscribe((e) => seen.push(e));
};

describe("live events from audit rows (ADR-0010)", () => {
  it("approve → one package.approved with the current version and the approver", async () => {
    const api = await as("u2");
    record();
    await unwrap(approve(api, "1"));
    expect(seen.map((e) => e.type)).toEqual(["package.approved", "notification.created"]);
    seen.forEach((e) => assertSchema("LiveEvent", e));
    expect(seen.slice(0, 1)).toEqual([
      {
        event_id: expect.stringMatching(/^0193a000-0000-7000-800a-/),
        company_id: id.company(),
        type: "package.approved",
        package_id: pkgId(1038),
        package_version: 1,
        actor_id: id.user("u2"),
        at: expect.stringMatching(/Z$/),
      },
    ]);
  });

  it("idempotent repeat, 409 and 403 emit nothing", async () => {
    const api = await as("u2");
    await unwrap(approve(api, "2"));
    record();
    await unwrap(approve(api, "2"));
    await approve(api, "3", 9).catch(() => {});
    await approve(await as("u1"), "4").catch(() => {});
    expect(seen).toEqual([]);
  });

  it("a failing listener neither fails the write nor starves other listeners", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const off = mock.events.subscribe(() => {
      throw new Error("closed");
    });
    record();
    await unwrap(approve(await as("u2"), "5"));
    off();
    quiet.mockRestore();
    expect(seen.map((e) => e.type)).toContain("package.approved");
  });

  it("reads emit nothing", async () => {
    const api = await as("u1");
    record();
    await unwrap(api.GET("/v1/packages", {}));
    expect(seen).toEqual([]);
  });

  it("maps audit actions to event types", () => {
    expect(
      [
        "package.created",
        "package.deleted",
        "approval.created",
        "export.created",
        "task.resolved",
        "requirements.updated",
        "field.corrected",
        "approval.invalidated",
      ].map(eventType),
    ).toEqual([
      "package.created",
      "package.deleted",
      "package.approved",
      "package.exported",
      "task.changed",
      "requirements.changed",
      "package.updated",
      "package.updated",
    ]);
  });
});
