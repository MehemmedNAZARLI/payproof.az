import packages from "@fixtures/packages.json";
import { describe, expect, it } from "vitest";

import { packageDetail } from "./package-detail";
import { mockPaper } from "./paper";
import { mockUuid } from "./store";

const regions = (versionId: string) =>
  (mockPaper(versionId)?.pages ?? []).flatMap((p) => [
    ...p.meta.map((r) => r.quote),
    ...p.rows.map((r) => r.quote),
    p.total?.quote,
    p.signatures?.quote,
  ]);

describe("mock paper", () => {
  it("has a region for every evidence quote, except text the scan could not read", () => {
    let cited = 0;
    for (const p of packages) {
      const detail = packageDetail(mockUuid("package", p.id), "u2")!;
      for (const check of detail.checks)
        for (const e of check.evidence) {
          cited++;
          const found = regions(e.document_version_id).includes(e.quote);
          expect(found, `${p.invoice_number} ${check.rule_id}: ${e.quote}`).toBe(
            !e.quote.endsWith("(oxunmur)"),
          );
        }
    }
    expect(cited).toBeGreaterThan(50);
  });

  it("blurs an unreadable PO instead of offering it as a highlight", () => {
    const inv = packageDetail(mockUuid("package", "pkg_1047"), "u2")!.documents[0]!;
    const page = mockPaper(inv.current.id)!.pages[0]!;
    expect(page.scan).toBe(true);
    expect(page.meta.find((r) => r.label === "Sifariş №")).toEqual({
      label: "Sifariş №",
      value: "PO-3?7",
      quote: null,
      unreadable: true,
    });
  });

  it("shows every candidate order, marked unconfirmed, while the link is open", () => {
    const detail = packageDetail(mockUuid("package", "pkg_1048"), "u2")!;
    const order = detail.documents.find((d) => d.type === "order")!;
    const pages = mockPaper(order.current.id)!.pages;
    expect(pages.map((x) => [x.number, x.notice])).toEqual([
      ["PO-383", "Namizəd — təsdiqlənməyib"],
      ["PO-384", "Namizəd — təsdiqlənməyib"],
    ]);
  });

  it("draws the signature and stamp only on a signed delivery note", () => {
    const detail = packageDetail(mockUuid("package", "pkg_1038"), "u2")!;
    const delivery = detail.documents.find((d) => d.type === "delivery")!;
    const page = mockPaper(delivery.current.id)!.pages[0]!;
    expect(page.signatures).toMatchObject({ signed: true });
    expect(page.stamp).toBe("B");
    expect(mockPaper("0193a000-0000-7000-8005-000099990001")).toBeUndefined();
  });
});
