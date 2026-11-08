import packages from "@fixtures/packages.json";
import { describe, expect, it } from "vitest";

import { link, packageTasks, permissions } from "./detail-parts";
import { meFor } from "./store";

const fixture = (invoice: string) => packages.find((p) => p.invoice_number === invoice)!;
const ref = { id: "x", invoice_number: "INV" };

describe("mock detail parts", () => {
  it("lists AI candidates with their order total until a human confirms the link", () => {
    expect(link(fixture("INV-1042"))).toMatchObject({
      confirmed: false,
      order_id: null,
      candidates: [
        {
          order_id: "0193a000-0000-7000-8003-000000000381",
          po_number: "PO-381",
          total: { amount: "12000.00", currency: "AZN" },
        },
      ],
    });
  });

  it("names the person who confirmed a link, and nobody for an exact-ID link", () => {
    expect(link(fixture("INV-1043")).confirmed_by?.full_name).toBe("Aygün Məmmədova");
    expect(link(fixture("INV-1038"))).toMatchObject({ method: "exact_id", confirmed_by: null });
  });

  it("includes resolved tasks so the client can choose what to show", () => {
    expect(packageTasks(fixture("INV-1038"), ref).map((t) => [t.number, t.status])).toEqual([
      ["T-114", "RESOLVED"],
    ]);
  });

  it("combines role permission with the package state", () => {
    const approver = meFor("u2")!;
    expect(permissions("READY_FOR_APPROVAL", false, approver).can_approve).toBe(true);
    expect(permissions("NEEDS_FIX", false, approver).can_approve).toBe(false);
    expect(permissions("READY_FOR_APPROVAL", false, meFor("u1")!).can_approve).toBe(false);
    expect(permissions("APPROVED_READY", true, meFor("u1")!)).toMatchObject({
      can_export: true,
      can_delete: false,
    });
    expect(Object.values(permissions("NEEDS_FIX", false, meFor("u5")!))).not.toContain(true);
  });
});
