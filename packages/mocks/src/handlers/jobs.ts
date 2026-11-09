// Job status (finishes package processing when due) and short-lived document file links.
import { http, HttpResponse } from "msw";
import { finishProcessing } from "../domain/packages";
import { id } from "../ids";
import { currentUser, json, notFound, route, signedLink, type Ctx } from "./http";

export const jobHandlers = (ctx: Ctx) => [
  http.get(
    "*/v1/documents/versions/:version_id/file",
    route(ctx, ({ request, params }, db) => {
      currentUser(db, request);
      const ok = db.packages.some(
        (p) =>
          !p.deleted &&
          p.documents.some((d) =>
            d.versions.some((v) => id.version(p.id, d.type, v.version_no) === params.version_id),
          ),
      );
      if (!ok) throw notFound();
      return json(signedLink(db, request, String(params.version_id)));
    }),
  ),
  http.get(
    "*/mock-files/:version_id",
    ({ params }) =>
      new HttpResponse(`PayProof demo faylı ${String(params.version_id)}\n`, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }),
  ),
  http.get(
    "*/v1/jobs/:job_id",
    route(ctx, ({ request, params }, db) => {
      currentUser(db, request);
      const job = db.jobs.get(String(params.job_id));
      if (!job) throw notFound();
      const ready = Date.now() >= job.ready_at_ms;
      const p = job.package_id ? db.pkg(job.package_id) : null;
      if (ready && !job.done) {
        if (job.kind === "create_package" && p) finishProcessing(db, p);
        job.done = true;
      }
      const failed = ready && !!job.error;
      return json({
        id: job.id,
        kind: job.kind,
        status: !ready ? "RUNNING" : failed ? "FAILED" : "SUCCEEDED",
        created_at: job.created_at,
        updated_at: db.nowIso(),
        result:
          ready && p && !failed
            ? {
                package_id: id.pkg(p.id),
                package_version: p.version,
                ...(job.document_version_id
                  ? { document_version_id: job.document_version_id }
                  : {}),
              }
            : null,
        error: failed ? job.error : null,
      });
    }),
  ),
];
