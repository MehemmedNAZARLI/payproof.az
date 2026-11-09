// Acceptance: the full INV-1042 flow through @payproof/api-client against @payproof/mocks/node.
import { createApiClient, toFormData, unwrap, type Schemas } from "@payproof/api-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import expected from "../../../fixtures/expected.json";
import { mockIds } from "../src";
import { createMockServer } from "../src/node";

const { server } = createMockServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterAll(() => server.close());

const BASE = "http://payproof.test";
const steps = new Map(expected.flows["INV-1042"].map((s) => [s.step, s]));
const pkg = { params: { path: { package_id: mockIds.pkg("pkg_1042") } } };
let n = 0;
const key = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

async function login(user: string) {
  const anon = createApiClient({ baseUrl: BASE });
  const s = await unwrap(
    anon.POST("/v1/auth/dev-login", { body: { user_id: mockIds.user(user) } }),
  );
  return createApiClient({ baseUrl: BASE, getToken: () => s.access_token });
}

function expectStep(d: Schemas["PackageDetail"], step: string) {
  const want = steps.get(step)!;
  expect({ step, status: d.status, version: d.version, blocking: d.summary.blocking }).toEqual({
    step,
    status: want.status,
    version: want.version,
    blocking: want.blockers,
  });
}

describe("INV-1042 end to end (mock API)", () => {
  it("link → upload → duplicate → delivery → signature → approve → export", async () => {
    const op = await login("u1");
    const approver = await login("u2");
    const detail = () => unwrap(op.GET("/v1/packages/{package_id}", pkg));
    const upload = async (type: "invoice" | "delivery", name: string, v: number) =>
      op.POST("/v1/packages/{package_id}/documents", {
        params: { ...pkg.params, header: { "Idempotency-Key": key() } },
        body: { type, file: new File(["%PDF"], name), expected_version: v },
        bodySerializer: toFormData,
      });

    expectStep(await detail(), "initial");
    const linked = await unwrap(
      op.POST("/v1/packages/{package_id}/matches", {
        ...pkg,
        body: { order_id: mockIds.order("PO-381"), expected_version: 1 },
      }),
    );
    expectStep(linked, "confirm_link");
    // a stale version is rejected
    await expect(upload("invoice", "INV-1042_v2_PO-381.pdf", 1)).rejects.toMatchObject({
      status: 409,
      code: "VERSION_CONFLICT",
    });

    await unwrap(upload("invoice", "INV-1042_v2_PO-381.pdf", 2));
    expectStep(await detail(), "upload_invoice");
    await expect(upload("invoice", "INV-1042.pdf", 3)).rejects.toMatchObject({
      code: "DUPLICATE_FILE",
    });
    expectStep(await detail(), "upload_duplicate");
    await unwrap(upload("delivery", "TS-5531_imzali.pdf", 3));
    expectStep(await detail(), "upload_delivery");
    expectStep(
      await unwrap(
        op.POST("/v1/packages/{package_id}/signature-review", {
          ...pkg,
          body: { expected_version: 4 },
        }),
      ),
      "review_signature",
    );

    const approveBody = {
      expected_version: 4,
      expected_requirement_set_version: 2,
      documents_reviewed: true as const,
    };
    const approve = (api: typeof op) =>
      api.POST("/v1/packages/{package_id}/approve", {
        params: { ...pkg.params, header: { "Idempotency-Key": key() } },
        body: approveBody,
      });
    await expect(approve(op)).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    const first = await unwrap(approve(approver));
    expectStep(await detail(), "approve");
    expect(await unwrap(approve(approver))).toEqual(first);

    const d = await detail();
    const exportBody = {
      expected_version: 4,
      expected_requirement_set_version: 2,
      document_version_ids: d.documents.map((x) => x.current.id),
    };
    const exp = (k: string) =>
      op.POST("/v1/packages/{package_id}/export", {
        params: { ...pkg.params, header: { "Idempotency-Key": k } },
        body: exportBody,
      });
    const first_export = await unwrap(exp(key()));
    expect(first_export.export.files.map((f) => f.file_name)).toEqual(steps.get("export")!.files);
    expectStep(await detail(), "export");
    expect((await unwrap(exp(key()))).export).toEqual(first_export.export);
    expect((await detail()).exports).toHaveLength(1);
  });
});
