import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api";

import { approvalFailure } from "./queries";

const err = (code: ConstructorParameters<typeof ApiError>[0], status: number) =>
  new ApiError(code, "msg", status);

describe("approvalFailure", () => {
  it.each([
    [err("VERSION_CONFLICT", 409), { kind: "conflict" }],
    [
      new ApiError("VERSION_CONFLICT", "m", 409, { current_version: 4 }),
      { kind: "conflict", version: 4 },
    ],
    [err("IDEMPOTENCY_KEY_REUSED", 422), { kind: "conflict" }],
    [err("FORBIDDEN", 403), { kind: "forbidden" }],
    [err("PACKAGE_NOT_READY", 409), { kind: "not-ready", message: "msg" }],
    [err("IDEMPOTENCY_IN_PROGRESS", 409), { kind: "in-progress" }],
    [err("NETWORK_ERROR", 0), { kind: "offline" }],
    [err("INTERNAL_ERROR", 500), { kind: "other", message: "msg" }],
    [new Error("boom"), { kind: "other", message: "" }],
  ])("maps %s", (error, kind) => {
    expect(approvalFailure(error)).toEqual(kind);
  });
});
