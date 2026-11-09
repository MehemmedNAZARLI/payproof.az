import type { Schemas } from "@payproof/api-client";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { PaperPage } from "./paper-page";

const ev = (quote: string, page = 1, document_version_id = "v1") => ({
  document_version_id,
  page,
  quote,
  bbox: null,
});
const pkg = {
  customer: { name: "B Mağazalar Şəbəkəsi" },
  fields: [
    { evidence: ev("Sifariş №: PO-388") },
    { evidence: ev("Kərə yağı — 50 blok × 110,00") },
    { evidence: ev("Başqa səhifə", 2) },
    { evidence: ev("Başqa versiya", 1, "v0") },
  ],
} as unknown as Schemas["PackageDetail"];
const version = {
  id: "v1",
  version_no: 1,
  file_name: "INV-1044.pdf",
  source_kind: "pdf",
} as Schemas["DocumentVersion"];

test("shows the extracted text of this page and version, with the cited quote marked", () => {
  render(
    <PaperPage
      pkg={pkg}
      version={version}
      docType="invoice"
      evidence={ev("Kərə yağı — 50 blok × 110,00")}
    />,
  );
  expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
    "Sifariş №: PO-388",
    "Kərə yağı — 50 blok × 110,00",
  ]);
  expect(screen.getByRole("mark")).toHaveTextContent("Kərə yağı — 50 blok × 110,00");
  expect(screen.getByText("Səhifə 1")).toBeInTheDocument();
});
