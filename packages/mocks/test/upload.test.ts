import { describe, expect, it } from "vitest";
import packages from "../../../fixtures/packages.json";
import { confirmLink, reviewSignature } from "../src/domain/review";
import { sha256, uploadDocument } from "../src/domain/upload";
import { info } from "../src/engine/status";
import { createMockDb } from "../src/store";

describe("document upload", () => {
  it("uses the same synthetic sha256 as fixtures", async () => {
    const v1 = packages.find((p) => p.id === "pkg_1042")!.documents[0]!.versions[0]!;
    expect(await sha256(v1.file_name)).toBe(v1.sha256);
  });

  it("applies the sample's extraction and creates a new document version", async () => {
    const db = createMockDb();
    const p = db.pkg("pkg_1042");
    confirmLink(db, p, "PO-381", "u1");
    const r = await uploadDocument(db, p, "invoice", "INV-1042_v2_PO-381.pdf", "u1");
    expect(r).toEqual({ type: "invoice", version_no: 2 });
    expect(p.invoice.po_ref).toBe("PO-381");
    expect(p.version).toBe(3);
    expect(p.documents.find((d) => d.type === "invoice")!.versions[1]).toMatchObject({
      uploaded_by: "u1",
      package_version_at_upload: 3,
    });
  });

  it("re-uploading the same file is a duplicate — no new version", async () => {
    const db = createMockDb();
    const p = db.pkg("pkg_1042");
    await expect(uploadDocument(db, p, "invoice", "INV-1042.pdf", "u1")).rejects.toMatchObject({
      code: "DUPLICATE_FILE",
      status: 409,
    });
    expect(p.version).toBe(1);
  });

  it("a signed delivery needs a human signature review (R-008 UNKNOWN → PASS), idempotent", async () => {
    const db = createMockDb();
    const p = db.pkg("pkg_1042");
    confirmLink(db, p, "PO-381", "u1");
    await uploadDocument(db, p, "invoice", "INV-1042_v2_PO-381.pdf", "u1");
    await uploadDocument(db, p, "delivery", "TS-5531_imzali.pdf", "u1");
    expect(info(db, p).status).toBe("NEEDS_REVIEW");
    expect(p.version).toBe(4);
    expect(reviewSignature(db, p, "u1")).toBe(true);
    expect(reviewSignature(db, p, "u1")).toBe(false);
    expect(info(db, p).status).toBe("READY_FOR_APPROVAL");
  });
});
