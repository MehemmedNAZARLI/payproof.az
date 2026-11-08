import packages from "@fixtures/packages.json";
import { describe, expect, it } from "vitest";

import { contractErrors } from "@/test/contract";

import { findVersion, mockDocuments } from "./documents";

const fixture = (invoice: string) => packages.find((p) => p.invoice_number === invoice)!;

describe("mock documents", () => {
  it("numbers documents and versions per package in upload order, as the contract does", () => {
    const { documents } = mockDocuments(fixture("INV-1042"));
    expect(documents.map((d) => [d.type, d.id, d.current.id])).toEqual([
      ["invoice", "0193a000-0000-7000-8004-000010420001", "0193a000-0000-7000-8005-000010420001"],
      ["order", "0193a000-0000-7000-8004-000010420002", "0193a000-0000-7000-8005-000010420002"],
    ]);
    for (const d of documents) expect(contractErrors("Document", d)).toEqual([]);
  });

  it("keeps older versions as history and numbers the package version at upload", () => {
    const delivery = mockDocuments(fixture("INV-1036")).documents.find(
      (x) => x.type === "delivery",
    )!;
    expect(delivery.current).toMatchObject({ version_no: 3, package_version_at_upload: 3 });
    expect(delivery.history.map((v) => [v.version_no, v.package_version_at_upload])).toEqual([
      [2, 2],
      [1, 1],
    ]);
  });

  it("finds the package and type behind a version ID, including old versions", () => {
    const old = mockDocuments(fixture("INV-1036")).documents[2]!.history[1]!;
    expect(findVersion(packages, old.id)).toMatchObject({
      pkg: { id: "pkg_1036" },
      type: "delivery",
      version: { file_name: "TS-5518.jpg" },
    });
    expect(findVersion(packages, "0193a000-0000-7000-8005-000099990001")).toBeUndefined();
  });
});
