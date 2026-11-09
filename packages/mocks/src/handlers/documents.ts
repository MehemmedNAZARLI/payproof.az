// Upload (multipart, idempotent) → job; new version of an existing document.
import { http } from "msw";
import { MockError } from "../domain/audit";
import { uploadDocument } from "../domain/upload";
import { id, type DocType } from "../ids";
import type { MockDb } from "../store";
import type { Pkg } from "../types";
import {
  currentUser,
  expectVersion,
  idempotent,
  json,
  notFound,
  packageOf,
  requireEditable,
  requirePermission,
  route,
  versionParam,
  type Ctx,
} from "./http";
import { fileField, form, startJob } from "./multipart";

function documentOf(db: MockDb, uuid: string): { p: Pkg; type: DocType } | null {
  for (const p of db.packages)
    for (const d of p.documents)
      if (!p.deleted && id.document(p.id, d.type) === uuid) return { p, type: d.type };
  return null;
}

async function upload(db: MockDb, request: Request, p: Pkg, type: DocType, userId: string) {
  requireEditable(p);
  const f = await form(request);
  const file = fileField(f, "file")!;
  const expected = versionParam(f.get("expected_version"));
  return idempotent(db, request, `upload:${p.id}:${type}:${file.name}:${expected}`, async () => {
    expectVersion(p, expected);
    const v = await uploadDocument(db, p, type, file.name, userId);
    const versionId = id.version(p.id, type, v.version_no);
    const job = startJob(db, "extract_document", p, versionId);
    return json(
      { job_id: job.id, document_id: id.document(p.id, type), document_version_id: versionId },
      202,
    );
  });
}

export const documentHandlers = (ctx: Ctx) => [
  http.post(
    "*/v1/packages/:package_id/documents",
    route(ctx, async ({ request, params }, db) => {
      const user = currentUser(db, request);
      requirePermission(user, "EDIT_PACKAGE");
      const p = packageOf(db, params.package_id);
      const type = (
        await request
          .clone()
          .formData()
          .catch(() => null)
      )?.get("type");
      if (type !== "invoice" && type !== "order" && type !== "delivery")
        throw new MockError("VALIDATION_ERROR", "Sənəd növü yanlışdır.", 422, {
          fields: { type: "invoice | order | delivery" },
        });
      return upload(db, request, p, type, user.id);
    }),
  ),
  http.post(
    "*/v1/documents/:document_id/versions",
    route(ctx, async ({ request, params }, db) => {
      const user = currentUser(db, request);
      requirePermission(user, "EDIT_PACKAGE");
      const doc = documentOf(db, String(params.document_id));
      if (!doc) throw notFound();
      return upload(db, request, doc.p, doc.type, user.id);
    }),
  ),
];
