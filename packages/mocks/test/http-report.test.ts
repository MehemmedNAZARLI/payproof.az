import { unwrap } from "@payproof/api-client";
import { describe, expect, it } from "vitest";
import { id } from "../src/ids";
import { as, pkgId } from "./api";
import { assertSchema } from "./contract";

describe("report and export download", () => {
  it("internal report of INV-1044 conforms and carries the R-005 difference", async () => {
    const api = await as("u5");
    const r = await unwrap(
      api.GET("/v1/packages/{package_id}/internal-report", {
        params: { path: { package_id: pkgId(1044) } },
      }),
    );
    assertSchema("InternalReport", r);
    expect(r.checks.find((c) => c.rule_id === "R-005")?.data).toEqual({
      line_difference: { amount: "500.00", currency: "AZN" },
    });
  });

  it("readonly can re-download an existing export; unknown export → 404", async () => {
    const api = await as("u5");
    const dl = await unwrap(
      api.GET("/v1/exports/{export_id}/download", {
        params: { path: { export_id: id.export("pkg_1033", 1) } },
      }),
    );
    assertSchema("SignedUrl", dl);
    await expect(
      api.GET("/v1/exports/{export_id}/download", {
        params: { path: { export_id: id.export("pkg_1042", 1) } },
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
