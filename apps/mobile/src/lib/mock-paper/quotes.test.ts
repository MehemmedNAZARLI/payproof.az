import packages from "@fixtures/packages.json";
import { describe, expect, it } from "vitest";

import { packageModel } from "./model";
import { deliveryQuote, invoiceQuote, orderQuote } from "./quotes";

const model = (invoice: string) =>
  packageModel(packages.find((p) => p.invoice_number === invoice)!);

describe("evidence quotes", () => {
  it("quotes invoice regions with grouped money and quantities", () => {
    const m = model("INV-1038");
    expect(invoiceQuote(m, "po")).toBe("Sifariş №: PO-377");
    expect(invoiceQuote(m, "total")).toBe("Yekun: 4.860,00 AZN");
    expect(invoiceQuote(m, "line:ST-1")).toBe("Şəkər tozu, 1 kq — 1.200 ədəd × 2,05");
    expect(invoiceQuote(m, "line:XX-0")).toBe("—");
  });

  it("quotes the order and the delivery note from their own data", () => {
    const m = model("INV-1046");
    expect(orderQuote(m.order!, "customer")).toBe("Sifarişçi: B Mağazalar Şəbəkəsi");
    expect(deliveryQuote(m.delivery!, "customer")).toBe("Qəbul edən: C Restoran Qrupu");
    expect(deliveryQuote(m.delivery!, "po")).toBe("Əsas: sifariş PO-391");
    expect(deliveryQuote(m.delivery!, "line:DY-5")).toMatch(/— 150 kisə təhvil verilib$/);
  });

  it("has no quote for a region a document does not have", () => {
    expect(deliveryQuote(model("INV-1038").delivery!, "total")).toBeNull();
  });
});
