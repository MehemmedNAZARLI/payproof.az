import { toFormData, unwrap } from "@payproof/api-client";
import { describe, expect, it } from "vitest";
import { as, mock, pkgId } from "./api";
import { assertSchema } from "./contract";

const file = (name: string) => new File(["%PDF-1.7"], name, { type: "application/pdf" });
const KEY = (k: string) => ({
  "Idempotency-Key": `00000000-0000-4000-8000-${k.padStart(12, "0")}`,
});

async function linked1042() {
  const api = await as("u1");
  await unwrap(
    api.POST("/v1/packages/{package_id}/matches", {
      params: { path: { package_id: pkgId(1042) } },
      body: { order_id: "0193a000-0000-7000-8003-000000000381", expected_version: 1 },
    }),
  );
  return api;
}
const upload = (
  api: Awaited<ReturnType<typeof as>>,
  name: string,
  key: string,
  v: number,
  type = "invoice" as const,
) =>
  api.POST("/v1/packages/{package_id}/documents", {
    params: { path: { package_id: pkgId(1042) }, header: KEY(key) },
    body: { type, file: file(name), expected_version: v },
    bodySerializer: toFormData,
  });

describe("document handlers", () => {
  it("uploads → 202 job and a new package version", async () => {
    const api = await linked1042();
    assertSchema("JobAccepted", await unwrap(upload(api, "INV-1042_v2_PO-381.pdf", "1", 2)));
    expect(mock.db.pkg("pkg_1042")).toMatchObject({ version: 3, invoice: { po_ref: "PO-381" } });
  });

  it("replays the same Idempotency-Key without a second version", async () => {
    const api = await linked1042();
    const a = await unwrap(upload(api, "INV-1042_v2_PO-381.pdf", "2", 2));
    const b = await unwrap(upload(api, "INV-1042_v2_PO-381.pdf", "2", 2));
    expect(b).toEqual(a);
    expect(mock.db.pkg("pkg_1042").version).toBe(3);
  });

  it("the same file again → 409 DUPLICATE_FILE, no new version", async () => {
    const api = await linked1042();
    await expect(upload(api, "INV-1042.pdf", "3", 2)).rejects.toMatchObject({
      code: "DUPLICATE_FILE",
      status: 409,
    });
    expect(mock.db.pkg("pkg_1042").version).toBe(2);
  });

  it("rejects unsupported file types (415) and requires the key (422)", async () => {
    const api = await linked1042();
    await expect(upload(api, "macro.docm", "4", 2)).rejects.toMatchObject({
      code: "UNSUPPORTED_FILE_TYPE",
      status: 415,
    });
    await expect(
      api.POST("/v1/packages/{package_id}/documents", {
        params: { path: { package_id: pkgId(1042) }, header: {} as never },
        body: { type: "invoice", file: file("x.pdf"), expected_version: 2 },
        bodySerializer: toFormData,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("a new version of an existing document invalidates the approval", async () => {
    const api = await as("u1");
    const d = await unwrap(
      api.GET("/v1/packages/{package_id}", { params: { path: { package_id: pkgId(1035) } } }),
    );
    const dl = d.documents.find((x) => x.type === "delivery")!;
    await unwrap(
      api.POST("/v1/documents/{document_id}/versions", {
        params: { path: { document_id: dl.id }, header: KEY("5") },
        body: { file: file("TS-5515_v2.pdf"), expected_version: 1 },
        bodySerializer: toFormData,
      }),
    );
    const after = await unwrap(
      api.GET("/v1/packages/{package_id}", { params: { path: { package_id: pkgId(1035) } } }),
    );
    expect(after).toMatchObject({
      version: 2,
      status: "READY_FOR_APPROVAL",
      current_approval: null,
    });
  });
});
