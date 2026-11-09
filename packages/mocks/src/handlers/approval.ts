// Approve / export — version-bound and idempotent, in the state-machines.md check order.
import { http } from "msw";
import { approvePackage, exportPackage } from "../domain/approval";
import { MockError } from "../domain/audit";
import { rulesFor } from "../engine";
import { currentApproval, info } from "../engine/status";
import { id } from "../ids";
import type { MockDb } from "../store";
import type { Pkg } from "../types";
import { approval, exportRecord } from "../views/records";
import {
  body,
  currentUser,
  expectVersion,
  idempotent,
  json,
  packageOf,
  requirePermission,
  route,
  signedLink,
  type Ctx,
} from "./http";

function expectRuleSet(db: MockDb, p: Pkg, expected: unknown) {
  const current = rulesFor(db, p).version;
  if (expected !== current)
    throw new MockError(
      "VERSION_CONFLICT",
      `Müştəri qaydası v${current}-ə yenilənib; yenidən baxın.`,
      409,
      {
        current_requirement_set_version: current,
        expected_requirement_set_version: expected,
      },
    );
}

export const approvalHandlers = (ctx: Ctx) => [
  http.post(
    "*/v1/packages/:package_id/approve",
    route(ctx, async ({ request, params }, db) => {
      const user = currentUser(db, request);
      requirePermission(user, "APPROVE_PACKAGE");
      const p = packageOf(db, params.package_id);
      const b = await body(request);
      return idempotent(db, request, `approve:${p.id}:${JSON.stringify(b)}`, async () => {
        expectVersion(p, b.expected_version);
        expectRuleSet(db, p, b.expected_requirement_set_version);
        // state-machines.md: an existing approval of this version is returned before body validation
        const existing = currentApproval(db, p);
        if (existing) return json(approval(db, p, existing));
        if (b.documents_reviewed !== true)
          throw new MockError("VALIDATION_ERROR", "Təsdiqdən əvvəl bütün sənədlərə baxın.", 422, {
            fields: { documents_reviewed: "true olmalıdır." },
          });
        return json(approval(db, p, approvePackage(db, p, user.id).approval));
      });
    }),
  ),
  http.post(
    "*/v1/packages/:package_id/export",
    route(ctx, async ({ request, params }, db) => {
      const user = currentUser(db, request);
      requirePermission(user, "EXPORT_PACKAGE");
      const p = packageOf(db, params.package_id);
      const b = await body(request);
      return idempotent(db, request, `export:${p.id}:${JSON.stringify(b)}`, async () => {
        expectVersion(p, b.expected_version);
        expectRuleSet(db, p, b.expected_requirement_set_version);
        // order: existing export → 200, not approved → 409, only then the selected documents
        const done = p.exports.find((e) => e.package_version === p.version);
        const respond = (rec: Parameters<typeof exportRecord>[2]) => {
          const record = exportRecord(db, p, rec);
          return json({ export: record, download: signedLink(db, request, `${record.id}.zip`) });
        };
        if (done) return respond(done);
        if (info(db, p).status !== "APPROVED_READY")
          throw new MockError(
            "PACKAGE_NOT_READY",
            "İxrac üçün cari versiyanın təsdiqi tələb olunur.",
            409,
            {
              status: info(db, p).status,
            },
          );
        const ids = Array.isArray(b.document_version_ids) ? b.document_version_ids : [];
        if (!ids.length || new Set(ids).size !== ids.length)
          throw new MockError("VALIDATION_ERROR", "Hər sənədi bir dəfə seçin.", 422, {
            fields: { document_version_ids: "Boş və ya təkrarlanan ola bilməz." },
          });
        const files = ids.map((vid) => {
          const d = p.documents.find(
            (x) => id.version(p.id, x.type, x.versions.at(-1)!.version_no) === vid,
          );
          if (!d)
            throw new MockError(
              "VALIDATION_ERROR",
              "Yalnız sənədlərin cari versiyası ixrac edilə bilər.",
              422,
              { document_version_id: vid },
            );
          return { type: d.type, file_name: d.versions.at(-1)!.file_name };
        });
        return respond(exportPackage(db, p, user.id, files).export);
      });
    }),
  ),
];
