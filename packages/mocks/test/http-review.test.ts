import { unwrap } from "@payproof/api-client";
import { describe, expect, it } from "vitest";
import { as, pkgId } from "./api";
import { assertSchema } from "./contract";

const PKG = (n: number) => ({ params: { path: { package_id: pkgId(n) } } });

describe("review handlers", () => {
  it("confirms the order link → v2 NEEDS_FIX, returns the updated detail", async () => {
    const api = await as("u1");
    const d = await unwrap(
      api.POST("/v1/packages/{package_id}/matches", {
        ...PKG(1042),
        body: { order_id: "0193a000-0000-7000-8003-000000000381", expected_version: 1 },
      }),
    );
    assertSchema("PackageDetail", d);
    expect(d).toMatchObject({
      version: 2,
      status: "NEEDS_FIX",
      link: { confirmed: true, order_po: "PO-381", method: "human" },
    });
  });

  it("an old expected_version → 409 VERSION_CONFLICT with the current version", async () => {
    const api = await as("u1");
    await expect(
      api.POST("/v1/packages/{package_id}/validate", {
        ...PKG(1044),
        body: { expected_version: 7 },
      }),
    ).rejects.toMatchObject({
      code: "VERSION_CONFLICT",
      status: 409,
      details: { current_version: 1 },
    });
  });

  it("readonly cannot change anything → 403", async () => {
    const api = await as("u5");
    await expect(
      api.POST("/v1/packages/{package_id}/validate", {
        ...PKG(1044),
        body: { expected_version: 1 },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("corrects the unreadable PO through the field id → READY_FOR_APPROVAL", async () => {
    const api = await as("u1");
    const before = await unwrap(api.GET("/v1/packages/{package_id}", PKG(1047)));
    const po = before.fields.find((f) => f.field_path === "invoice.po_ref")!;
    const after = await unwrap(
      api.PATCH("/v1/fields/{field_id}", {
        params: { path: { field_id: po.id } },
        body: {
          value: "PO-397",
          reason: "Skanda PO mənbəyə baxaraq təsdiqləndi",
          expected_version: 1,
        },
      }),
    );
    expect(after).toMatchObject({ version: 2, status: "READY_FOR_APPROVAL" });
    expect(after.fields[0]).toMatchObject({ value: "PO-397", review_status: "CORRECTED" });
  });

  it("rejects a correction without a reason (422)", async () => {
    const api = await as("u1");
    const d = await unwrap(api.GET("/v1/packages/{package_id}", PKG(1044)));
    await expect(
      api.PATCH("/v1/fields/{field_id}", {
        params: { path: { field_id: d.fields[2]!.id } },
        body: { value: "100.00", reason: "", expected_version: 1 },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 422 });
  });
});
