import { beforeEach, describe, expect, it } from "vitest";

import { contractErrors } from "@/test/contract";

import { approve } from "./approve";
import { notificationPage, readAll, readOne } from "./notifications";
import { packageDetail } from "./package-detail";
import { resetSessionDb } from "./session-db";

const page = (slug: string, unreadOnly = false) => notificationPage(slug, unreadOnly, 50);

describe("mock notifications", () => {
  beforeEach(resetSessionDb);

  it("lists only the user's own, newest first, and conforms to the contract", () => {
    const p = page("u2");
    expect(p.items.map((n) => n.text)).toEqual([
      "INV-1035 təsdiqləndi və ixrac gözləyir.",
      expect.stringMatching(/^INV-1036: təhvil sənədinin yeni versiyası/),
      "INV-1038 təsdiqinizi gözləyir · 4.860,00 AZN",
      "INV-1033 paketi ixrac edildi (v1).",
    ]);
    expect(p.unread_count).toBe(2);
    for (const n of p.items) expect(contractErrors("Notification", n)).toEqual([]);
  });

  it("marks one read, refuses another user's, and reads all", () => {
    const [, second] = page("u2").items;
    expect(readOne("u2", second!.id)).toBe(true);
    expect(page("u2").unread_count).toBe(1);
    expect(readOne("u1", second!.id)).toBe(false);
    readAll("u2");
    expect(page("u2", true)).toMatchObject({ items: [], unread_count: 0 });
    expect(page("u1").unread_count).toBeGreaterThan(0);
  });

  it("tells the package owner when their package is approved", () => {
    const d = packageDetail("0193a000-0000-7000-8002-000000001038", "u2")!;
    const before = page("u1").unread_count;
    approve({
      userSlug: "u2",
      packageId: d.id,
      key: "6f1d2c3b-4a5e-4f60-9a7b-8c9d0e1f2a3b",
      body: {
        expected_version: d.version,
        expected_requirement_set_version: d.requirement_set.version,
        documents_reviewed: true,
      },
    });
    const p = page("u1");
    expect(p.unread_count).toBe(before + 1);
    expect(p.items[0]).toMatchObject({
      text: "INV-1038 Rəşad Əliyev tərəfindən təsdiqləndi — paket göndərilməyə hazırdır.",
      package: { id: d.id, invoice_number: "INV-1038" },
      read_at: null,
    });
  });
});
