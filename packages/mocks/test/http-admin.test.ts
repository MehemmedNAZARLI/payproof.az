import { toFormData, unwrap } from "@payproof/api-client";
import { describe, expect, it } from "vitest";
import { id } from "../src/ids";
import { as, mock, pkgId } from "./api";
import { assertSchema } from "./contract";

const pdf = (name: string) => new File(["%PDF"], name);

describe("admin handlers", () => {
  it("creates INV-1051 from a demo set → 202; PROCESSING until the job is polled; then READY", async () => {
    const api = await as("u1");
    const accepted = await unwrap(
      api.POST("/v1/packages", {
        params: { header: { "Idempotency-Key": "00000000-0000-4000-8000-000000001051" } },
        body: {
          customer_id: id.customer("c2"),
          owner_id: id.user("u1"),
          invoice: pdf("INV-1051.pdf"),
          order: new File(["x"], "PO-399.xlsx"),
          delivery: new File(["x"], "TS-5547.jpg"),
        },
        bodySerializer: toFormData,
      }),
    );
    const path = { params: { path: { package_id: accepted.package_id! } } };
    expect((await unwrap(api.GET("/v1/packages/{package_id}", path))).status).toBe("PROCESSING");
    await unwrap(api.GET("/v1/jobs/{job_id}", { params: { path: { job_id: accepted.job_id } } }));
    expect((await unwrap(api.GET("/v1/packages/{package_id}", path))).status).toBe(
      "READY_FOR_APPROVAL",
    );
  });

  it("deletes a never-approved package (204), refuses an approved one (409)", async () => {
    const api = await as("u1");
    const del = (n: number) =>
      api.DELETE("/v1/packages/{package_id}", {
        params: { path: { package_id: pkgId(n) }, query: { expected_version: n === 1036 ? 3 : 1 } },
      });
    expect((await del(1043)).response.status).toBe(204);
    await expect(del(1036)).rejects.toMatchObject({ code: "PACKAGE_NOT_DELETABLE", status: 409 });
  });

  it("an unknown file set is rejected (422) — mock mode only knows the demo sets", async () => {
    const api = await as("u1");
    await expect(
      api.POST("/v1/packages", {
        params: { header: { "Idempotency-Key": "00000000-0000-4000-8000-000000009999" } },
        body: {
          customer_id: id.customer("c1"),
          owner_id: id.user("u1"),
          invoice: pdf("random.pdf"),
        },
        bodySerializer: toFormData,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 422 });
  });

  it("a duplicate invoice is accepted (202) and reported by the job as FAILED", async () => {
    const api = await as("u1");
    const create = (k: string) =>
      unwrap(
        api.POST("/v1/packages", {
          params: { header: { "Idempotency-Key": `00000000-0000-4000-8000-00000000${k}` } },
          body: {
            customer_id: id.customer("c2"),
            owner_id: id.user("u1"),
            invoice: pdf("INV-1051.pdf"),
          },
          bodySerializer: toFormData,
        }),
      );
    await create("0001");
    const dup = await create("0002");
    expect(dup.package_id).toBeUndefined();
    const job = await unwrap(
      api.GET("/v1/jobs/{job_id}", { params: { path: { job_id: dup.job_id } } }),
    );
    assertSchema("Job", job);
    expect(job).toMatchObject({
      status: "FAILED",
      result: null,
      error: { code: "DUPLICATE_INVOICE" },
    });
  });
});
