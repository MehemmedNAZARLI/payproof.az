import { beforeEach, describe, expect, it } from "vitest";

import { clearSeen, isSeen, markSeen, seenCount } from "./seen-store";

const pkg = (version: number) => ({ id: "p1", version });
const U = "u2";

beforeEach(() => {
  clearSeen();
  sessionStorage.clear();
});

describe("seen documents", () => {
  it("remembers a document version for the package version it was seen in", () => {
    expect(isSeen(U, pkg(1), "doc-v1")).toBe(false);
    markSeen(U, pkg(1), "doc-v1");
    expect(isSeen(U, pkg(1), "doc-v1")).toBe(true);
    expect(seenCount(U, pkg(1), ["doc-v1", "order-v1"])).toBe(1);
  });

  it("forgets everything when the package version changes", () => {
    markSeen(U, pkg(1), "doc-v1");
    markSeen(U, pkg(1), "order-v1");
    expect(isSeen(U, pkg(2), "doc-v1")).toBe(false);
    markSeen(U, pkg(2), "doc-v2");
    // Going back to an old version (a stale screen) does not bring old views back either.
    expect(isSeen(U, pkg(1), "order-v1")).toBe(false);
    expect(seenCount(U, pkg(2), ["doc-v2", "order-v1"])).toBe(1);
  });

  it("keeps views per user", () => {
    markSeen(U, pkg(1), "doc-v1");
    expect(isSeen("u1", pkg(1), "doc-v1")).toBe(false);
  });

  it("lives in this tab's session storage, and clears on sign-out", () => {
    markSeen(U, pkg(1), "doc-v1");
    expect(JSON.parse(sessionStorage.getItem("payproof.seen") ?? "{}")).toEqual({
      "u2|p1": { version: 1, seen: ["doc-v1"] },
    });
    // What a reload finds there counts, and a damaged entry counts as nothing seen.
    sessionStorage.setItem("payproof.seen", '{"u2|p1":{"version":1,"seen":["order-v1"]}}');
    expect(isSeen(U, pkg(1), "order-v1")).toBe(true);
    sessionStorage.setItem("payproof.seen", "{not json");
    expect(isSeen(U, pkg(1), "order-v1")).toBe(false);
    markSeen(U, pkg(1), "doc-v1");
    clearSeen();
    expect(isSeen(U, pkg(1), "doc-v1")).toBe(false);
    expect(sessionStorage.getItem("payproof.seen")).toBeNull();
  });
});
