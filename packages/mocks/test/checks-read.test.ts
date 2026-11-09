import { describe, expect, it } from "vitest";
import { normalizeName, read, sameCounterparty } from "../src/checks/read";
import type { GenericDoc } from "../src/checks/types";

const doc = (over: Partial<GenericDoc> = {}): GenericDoc => ({
  id: "d1",
  type: "invoice",
  file_name: "KE-1.pdf",
  pages: 1,
  fields: { seller: { name: "Kitab Evi MMC", tax_id: "1403216781" }, total: "10.00", po_ref: null },
  unreadable: [],
  tables: {},
  evidence: {
    seller: { page: 1, quote: "Kitab Evi MMC" },
    total: { page: 1, quote: "Cəmi: 10,00" },
  },
  ...over,
});

describe("generic check field reading", () => {
  it("reads a field and a party part with their source", () => {
    expect(read(doc(), "seller.tax_id")).toEqual({
      status: "ok",
      value: "1403216781",
      evidence: { document_id: "d1", field: "seller", page: 1, quote: "Kitab Evi MMC" },
    });
  });

  it("null, absent or source-less values are missing — never read", () => {
    expect(read(doc(), "po_ref").status).toBe("missing");
    expect(read(doc(), "seller.id_number").status).toBe("missing");
    expect(read(doc({ evidence: {} }), "total").status).toBe("missing");
    expect(read(doc({ fields: { seller: "Kitab" } }), "seller.tax_id").status).toBe("missing");
  });

  it("an unreadable field is UNKNOWN material, cited at the document when it has no source", () => {
    const r = read(doc({ unreadable: ["total"], evidence: {} }), "total");
    expect(r).toEqual({
      status: "unreadable",
      evidence: { document_id: "d1", field: "document", page: 1, quote: "KE-1.pdf" },
    });
  });

  it("normalizes Azerbaijani names, case and legal forms for counterparty matching", () => {
    expect(normalizeName("Ofis Ləvazimatları ASC")).toBe("ofislevazimatlari");
    expect(sameCounterparty("OFIS LEVAZIMATLARI", "Ofis Ləvazimatları ASC")).toBe(true);
    expect(sameCounterparty("TEXNO MARKET", "Texno Market MMC")).toBe(true);
    expect(sameCounterparty("İnam MMC", "INAM")).toBe(true);
    expect(sameCounterparty("COFFEE MOFFIE", "Kitab Evi MMC")).toBe(false);
    expect(sameCounterparty("MMC", "Kitab Evi MMC")).toBe(false);
    expect(sameCounterparty("Kitab MMC", "KITAB ALEMI")).toBe(false); // too short to contain-match
    expect(sameCounterparty("Kitab MMC", "KITAB")).toBe(true); // equal after normalization
  });
});
