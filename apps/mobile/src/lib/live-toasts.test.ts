import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { packageDetailKeys } from "@/features/package-detail/queries";
import { packageKeys } from "@/features/packages/queries";

import type { LiveEvent } from "./live";
import { cachedInvoice, liveToastText } from "./live-toasts";

const PKG = "0193a000-0000-7000-8002-000000001042";
const event = (type: string, package_version: number | null = 5) =>
  ({
    event_id: "0193a000-0000-7000-800a-000000000001",
    company_id: "0193a000-0000-7000-8000-00000000c0a1",
    type,
    package_id: PKG,
    package_version,
    actor_id: "0193a000-0000-7000-8000-000000000001",
    at: "2026-11-08T07:00:00Z",
  }) as LiveEvent;

describe("liveToastText", () => {
  it("says who did what to which package, and its new version", () => {
    const by = { actor: "Aygün Məmmədova", invoice: "INV-1042" };
    expect(liveToastText(event("package.updated"), by)).toBe(
      "Aygün Məmmədova INV-1042 package updated (v5)",
    );
    expect(liveToastText(event("package.exported"), by)).toBe(
      "Aygün Məmmədova INV-1042 package exported (v5)",
    );
    expect(liveToastText(event("task.changed"), by)).toBe(
      "Aygün Məmmədova INV-1042 package task updated",
    );
  });

  it("falls back to 'the package' and to the system when names are unknown", () => {
    expect(liveToastText(event("package.approved", null), { actor: null })).toBe(
      "System the package approved",
    );
  });

  it("gives notifications and unknown types no toast", () => {
    expect(liveToastText(event("notification.created"), { actor: "X" })).toBeNull();
    expect(liveToastText(event("invoice.teleported"), { actor: "X" })).toBeNull();
  });
});

describe("cachedInvoice", () => {
  it("reads the invoice number from a cached list page or detail", () => {
    const qc = new QueryClient();
    expect(cachedInvoice(qc, PKG)).toBeUndefined();
    qc.setQueryData(packageDetailKeys.detail(PKG), { id: PKG, invoice_number: "INV-1042" });
    expect(cachedInvoice(qc, PKG)).toBe("INV-1042");
    const other = new QueryClient();
    other.setQueryData(packageKeys.list({}), { items: [{ id: PKG, invoice_number: "INV-1042" }] });
    expect(cachedInvoice(other, PKG)).toBe("INV-1042");
  });
});
