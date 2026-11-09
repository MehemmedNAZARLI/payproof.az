// @vitest-environment node
// Multipart needs FormData, File and fetch from the same implementation (undici): jsdom's differ.
import { unwrap } from "@payproof/api-client";
import { mockIds } from "@payproof/mocks";
import { beforeEach, expect, test } from "vitest";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { createPackageRequest, demoSets, waitForJob } from "./new-package";

beforeEach(() => setToken(`mock.${mockIds.user("u1")}`));
const pdf = (name: string) => new File(["%PDF"], name, { type: "application/pdf" });

test("demo sets carry their customer's name and file names", () => {
  const [n1] = demoSets();
  expect(n1).toMatchObject({
    invoiceNumber: "INV-1051",
    customerName: "C Restoran Qrupu",
    files: { invoice: "INV-1051.pdf", order: "PO-399.xlsx", delivery: "TS-5547.jpg" },
  });
});

test("a new package is created PROCESSING and its job finishes it", async () => {
  const accepted = await createPackageRequest({
    customerId: mockIds.customer("c2"),
    ownerId: mockIds.user("u7"),
    files: {
      invoice: pdf("INV-1051.pdf"),
      order: pdf("PO-399.xlsx"),
      delivery: pdf("TS-5547.jpg"),
    },
    idempotencyKey: crypto.randomUUID(),
  });
  expect(accepted.package_id).toBeDefined();
  const job = await waitForJob(accepted.job_id, 1);
  expect(job.status).toBe("SUCCEEDED");
  const pkg = await unwrap(
    api.GET("/v1/packages/{package_id}", {
      params: { path: { package_id: accepted.package_id! } },
    }),
  );
  expect(pkg.status).not.toBe("PROCESSING");
});

test("a duplicate invoice is reported by the job (no package)", async () => {
  const input = {
    customerId: mockIds.customer("c1"),
    ownerId: mockIds.user("u1"),
    files: { invoice: pdf("INV-1052.pdf") },
  };
  const first = await createPackageRequest({ ...input, idempotencyKey: crypto.randomUUID() });
  await waitForJob(first.job_id, 1);
  const again = await createPackageRequest({ ...input, idempotencyKey: crypto.randomUUID() });
  expect(again.package_id).toBeUndefined();
  const job = await waitForJob(again.job_id, 1);
  expect(job).toMatchObject({ status: "FAILED", error: { code: "DUPLICATE_INVOICE" } });
});
