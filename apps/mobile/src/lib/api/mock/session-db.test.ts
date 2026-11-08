import { beforeEach, describe, expect, it } from "vitest";

import {
  addApproval,
  isRead,
  markRead,
  rememberReplay,
  replayOf,
  resetSessionDb,
  sessionApprovals,
} from "./session-db";

const approval = {
  id: "a1",
  packageId: "p1",
  packageVersion: 1,
  requirementSetVersion: 2,
  approverSlug: "u2",
  approvedAt: "2026-11-08T06:40:00Z",
};

describe("session db", () => {
  beforeEach(resetSessionDb);

  it("starts from the fixtures, with nothing written", () => {
    expect(sessionApprovals()).toEqual([]);
    expect(isRead("n1")).toBe(false);
  });

  it("keeps approvals and replays across a reload of the module state", () => {
    addApproval(approval);
    rememberReplay("k1", { fingerprint: "f", approvalId: "a1" });
    const raw = sessionStorage.getItem("payproof.mock-db");
    expect(JSON.parse(raw!)).toMatchObject({ approvals: [approval] });
    expect(replayOf("k1")).toEqual({ fingerprint: "f", approvalId: "a1" });
    expect(replayOf("k2")).toBeUndefined();
  });

  it("marks notifications read once", () => {
    markRead(["n1", "n2"]);
    markRead(["n1"]);
    expect(isRead("n1") && isRead("n2")).toBe(true);
    expect(JSON.parse(sessionStorage.getItem("payproof.mock-db")!).read).toEqual(["n1", "n2"]);
  });

  it("treats a damaged entry as empty", () => {
    resetSessionDb();
    sessionStorage.setItem("payproof.mock-db", "{nope");
    expect(sessionApprovals()).toEqual([]);
  });
});
