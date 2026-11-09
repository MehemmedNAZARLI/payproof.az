// ADR-0011 configuration reads (registry, check library) and output template upload (approver only).
import { http } from "msw";
import library from "../../../../fixtures/config/check-library.json";
import registry from "../../../../fixtures/config/document-types.json";
import { MockError } from "../domain/audit";
import { slugOf } from "../ids";
import { userRef } from "../views/records";
import { currentUser, json, notFound, requirePermission, route, type Ctx } from "./http";
import { form } from "./multipart";

const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export const configHandlers = (ctx: Ctx) => [
  http.get(
    "*/v1/document-types",
    route(ctx, ({ request }, db) => {
      currentUser(db, request);
      // instructions stay server-side (extraction prompt), as in the API
      const items = registry.map(({ instructions: _, ...t }) => t);
      return json({ items });
    }),
  ),
  http.get(
    "*/v1/check-library",
    route(ctx, ({ request }, db) => {
      currentUser(db, request);
      return json(library);
    }),
  ),
  http.post(
    "*/v1/customers/:customer_id/output-templates",
    route(ctx, async ({ request, params }, db) => {
      const user = currentUser(db, request);
      requirePermission(user, "MANAGE_REQUIREMENTS");
      const c = db.customers.find((x) => x.id === slugOf.customer(String(params.customer_id)));
      if (!c) throw notFound();
      const file = (await form(request)).get("file");
      if (!(file instanceof Blob))
        throw new MockError("VALIDATION_ERROR", "Fayl məcburidir.", 422, {
          fields: { file: "Məcburi sahə." },
        });
      const bytes = await file.arrayBuffer();
      const name = (file as File).name ?? "";
      const zip = new Uint8Array(bytes.slice(0, 2));
      if (!/\.docx$/i.test(name) || zip[0] !== 0x50 || zip[1] !== 0x4b)
        throw new MockError("UNSUPPORTED_FILE_TYPE", "Yalnız .docx şablonu qəbul olunur.", 415);
      // shortcut: the mock does not unzip the document; it echoes the customer's mapped placeholders
      const placeholders = (c.requirement_sets.at(-1)!.output?.placeholders ?? []).map(
        (p) => p.placeholder,
      );
      const sha256 = hex(await crypto.subtle.digest("SHA-256", bytes));
      return json(
        {
          id: `0193a000-0000-7000-800e-${sha256.slice(0, 12)}`,
          file_name: name,
          sha256,
          size: bytes.byteLength,
          placeholders,
          uploaded_by: userRef(db, user.id),
          created_at: db.nowIso(),
        },
        201,
      );
    }),
  ),
];
