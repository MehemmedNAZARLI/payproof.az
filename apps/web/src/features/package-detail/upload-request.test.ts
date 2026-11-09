// @vitest-environment node
// Multipart needs FormData, File and fetch from the same implementation (undici): jsdom's differ.
import { unwrap } from "@payproof/api-client";
import { mockIds } from "@payproof/mocks";
import { beforeEach, expect, test } from "vitest";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { uploadRequest } from "./mutations";

beforeEach(() => setToken(`mock.${mockIds.user("u1")}`));
const detail = (id: string) =>
  unwrap(api.GET("/v1/packages/{package_id}", { params: { path: { package_id: id } } }));
const pdf = (name: string) => new File(["%PDF"], name, { type: "application/pdf" });

test("a new invoice version is accepted and its job finishes", async () => {
  const pkg = await detail(mockIds.pkg("pkg_1042"));
  const invoice = pkg.documents.find((d) => d.type === "invoice")!;
  const accepted = await uploadRequest(pkg.id, {
    type: "invoice",
    file: pdf("INV-1042_v2_PO-381.pdf"),
    expectedVersion: pkg.version,
    idempotencyKey: crypto.randomUUID(),
    documentId: invoice.id,
  });
  let job = await unwrap(
    api.GET("/v1/jobs/{job_id}", { params: { path: { job_id: accepted.job_id } } }),
  );
  for (let i = 0; job.status !== "SUCCEEDED" && i < 20; i++)
    job = await unwrap(
      api.GET("/v1/jobs/{job_id}", { params: { path: { job_id: accepted.job_id } } }),
    );
  expect(job.status).toBe("SUCCEEDED");
  expect((await detail(pkg.id)).version).toBe(pkg.version + 1);
});

test("the same file again is refused (409 DUPLICATE_FILE) and creates no version", async () => {
  const pkg = await detail(mockIds.pkg("pkg_1042"));
  const invoice = pkg.documents.find((d) => d.type === "invoice")!;
  const again = uploadRequest(pkg.id, {
    type: "invoice",
    file: pdf(invoice.current.file_name),
    expectedVersion: pkg.version,
    idempotencyKey: crypto.randomUUID(),
    documentId: invoice.id,
  });
  await expect(again).rejects.toMatchObject({ status: 409, code: "DUPLICATE_FILE" });
  expect((await detail(pkg.id)).version).toBe(pkg.version);
});
