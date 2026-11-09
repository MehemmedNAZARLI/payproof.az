import { toFormData, unwrap } from "@payproof/api-client";
import { describe, expect, it } from "vitest";
import { startJob } from "../src/handlers/multipart";
import { as, mock, pkgId } from "./api";
import { assertSchema } from "./contract";

describe("jobs and file links", () => {
  it("an upload job reports SUCCEEDED with the resulting package version", async () => {
    const api = await as("u1");
    const accepted = await unwrap(
      api.POST("/v1/packages/{package_id}/documents", {
        params: {
          path: { package_id: pkgId(1044) },
          header: { "Idempotency-Key": "00000000-0000-4000-8000-000000000044" },
        },
        body: { type: "invoice", file: new File(["x"], "INV-1044_v2.pdf"), expected_version: 1 },
        bodySerializer: toFormData,
      }),
    );
    const job = await unwrap(
      api.GET("/v1/jobs/{job_id}", { params: { path: { job_id: accepted.job_id } } }),
    );
    assertSchema("Job", job);
    expect(job).toMatchObject({
      kind: "extract_document",
      status: "SUCCEEDED",
      result: { package_version: 2 },
    });
  });

  it("issues a 5-minute link that serves the (placeholder) file", async () => {
    const api = await as("u5");
    const d = await unwrap(
      api.GET("/v1/packages/{package_id}", { params: { path: { package_id: pkgId(1038) } } }),
    );
    const link = await unwrap(
      api.GET("/v1/documents/versions/{version_id}/file", {
        params: { path: { version_id: d.documents[0]!.current.id } },
      }),
    );
    assertSchema("SignedUrl", link);
    expect(Date.parse(link.expires_at) - Date.parse("2026-11-08T06:30:00Z")).toBeLessThanOrEqual(
      10 * 60_000,
    );
    expect((await fetch(link.url)).ok).toBe(true);
  });

  it("unknown job → 404", async () => {
    const api = await as("u1");
    await expect(
      api.GET("/v1/jobs/{job_id}", {
        params: { path: { job_id: "0193a000-0000-7000-8007-999999999999" } },
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("a job that failed before a package existed reports FAILED with the error code", async () => {
    const api = await as("u1");
    const job = startJob(mock.db, "create_package", null, undefined, {
      code: "DUPLICATE_INVOICE",
      message: "INV-1051 bu müştəri üçün artıq mövcuddur.",
    });
    const res = await unwrap(
      api.GET("/v1/jobs/{job_id}", { params: { path: { job_id: job.id } } }),
    );
    assertSchema("Job", res);
    expect(res).toMatchObject({
      status: "FAILED",
      result: null,
      error: { code: "DUPLICATE_INVOICE" },
    });
  });
});
