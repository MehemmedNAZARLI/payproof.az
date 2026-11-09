// Internal validation report and fresh download links for existing exports (VIEW permission).
import { http } from "msw";
import { rulesFor } from "../engine";
import { info } from "../engine/status";
import { id } from "../ids";
import { checkResult } from "../views/documents";
import { approval, exportRecord, pkgRef } from "../views/records";
import { currentUser, json, notFound, packageOf, route, signedLink, type Ctx } from "./http";

export const reportHandlers = (ctx: Ctx) => [
  http.get(
    "*/v1/packages/:package_id/internal-report",
    route(ctx, ({ request, params }, db) => {
      currentUser(db, request);
      const p = packageOf(db, params.package_id);
      const i = info(db, p);
      return json({
        package: pkgRef(db, p.id),
        version: p.version,
        status: i.status,
        requirement_set_version: rulesFor(db, p).version,
        generated_at: db.nowIso(),
        summary: {
          ...i.counts,
          blocking: i.primary.map((c) => ({ rule_id: c.rule_id, outcome: c.outcome })),
        },
        checks: i.checks.map((c) => checkResult(p, c)),
        approvals: p.approvals.map((a) => approval(db, p, a)),
        exports: p.exports.map((e) => exportRecord(db, p, e)),
      });
    }),
  ),
  http.get(
    "*/v1/exports/:export_id/download",
    route(ctx, ({ request, params }, db) => {
      currentUser(db, request);
      const found = db.packages.some(
        (p) =>
          !p.deleted &&
          p.exports.some((e) => id.export(p.id, e.package_version) === params.export_id),
      );
      if (!found) throw notFound();
      return json(signedLink(db, request, `${String(params.export_id)}.zip`));
    }),
  ),
];
