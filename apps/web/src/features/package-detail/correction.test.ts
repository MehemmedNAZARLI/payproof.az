import type { Schemas } from "@payproof/api-client";
import { expect, test } from "vitest";
import { fieldForCheck } from "./correction";

const ev = (v: string, quote: string) => ({ document_version_id: v, page: 1, quote, bbox: null });
const pkg = {
  fields: [
    {
      id: "po",
      field_path: "invoice.po_ref",
      review_status: "EXTRACTED",
      evidence: ev("inv", "PO-1"),
    },
    {
      id: "qty",
      field_path: "invoice.lines[KY-10].qty",
      review_status: "REVIEW_REQUIRED",
      evidence: ev("inv", "KY-10 … 3?0"),
    },
  ],
} as unknown as Schemas["PackageDetail"];
const check = (evidence: unknown[]) => ({ evidence }) as unknown as Schemas["CheckResult"];

test("the field the check's evidence points at", () => {
  expect(fieldForCheck(pkg, check([ev("inv", "KY-10 … 3?0")]))?.id).toBe("qty");
  expect(fieldForCheck(pkg, check([ev("inv", "PO-1")]))?.id).toBe("po");
});

test("no evidence: the one field still waiting for review, else none", () => {
  expect(fieldForCheck(pkg, check([]))?.id).toBe("qty");
  const none = { fields: [pkg.fields[0]] } as unknown as Schemas["PackageDetail"];
  expect(fieldForCheck(none, check([]))).toBeUndefined();
});
