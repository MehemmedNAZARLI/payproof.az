import { createApiClient, toFormData, unwrap } from "@payproof/api-client";
import { describe, expect, it } from "vitest";
import { id } from "../src/ids";
import { BASE, as, pkgId } from "./api";

const P1050 = { params: { path: { package_id: pkgId(1050) } } };

describe("server-side guards", () => {
  it("writes to a PROCESSING package are rejected (409 PACKAGE_NOT_READY)", async () => {
    const api = await as("u1");
    await expect(
      api.POST("/v1/packages/{package_id}/validate", { ...P1050, body: { expected_version: 1 } }),
    ).rejects.toMatchObject({ code: "PACKAGE_NOT_READY", status: 409 });
    await expect(
      api.POST("/v1/packages/{package_id}/documents", {
        params: {
          ...P1050.params,
          header: { "Idempotency-Key": "00000000-0000-4000-8000-000000000050" },
        },
        body: { type: "invoice", file: new File(["x"], "x.pdf"), expected_version: 1 },
        bodySerializer: toFormData,
      }),
    ).rejects.toMatchObject({ code: "PACKAGE_NOT_READY" });
  });

  it("a missing expected_version is 422, not a version conflict", async () => {
    const api = await as("u1");
    await expect(
      api.POST("/v1/packages/{package_id}/documents", {
        params: {
          path: { package_id: pkgId(1044) },
          header: { "Idempotency-Key": "00000000-0000-4000-8000-000000000051" },
        },
        body: { type: "invoice", file: new File(["x"], "x.pdf") } as never,
        bodySerializer: toFormData,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 422 });
    await expect(
      api.DELETE("/v1/packages/{package_id}", {
        params: { path: { package_id: pkgId(1043) }, query: {} as never },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 422 });
  });

  it("without a token the answer is 401 whether or not the package exists", async () => {
    const anon = createApiClient({ baseUrl: BASE });
    for (const package_id of [pkgId(1042), id.pkg("pkg_9999")])
      await expect(
        anon.GET("/v1/packages/{package_id}", { params: { path: { package_id } } }),
      ).rejects.toMatchObject({
        status: 401,
      });
    expect(await unwrap((await as("u5")).GET("/v1/packages/{package_id}", P1050))).toMatchObject({
      processing: true,
    });
  });
});
