// Audit log — per package and company-wide (search, filters, CSV). Newest first, append-only.
import { http, HttpResponse } from "msw";
import { slugOf } from "../ids";
import type { MockDb } from "../store";
import type { AuditEvent } from "../types";
import { auditEvent } from "../views/records";
import { currentUser, json, packageOf, page, route, type Ctx } from "./http";

const newestFirst = (a: AuditEvent, b: AuditEvent) =>
  b.created_at.localeCompare(a.created_at) || b.seq - a.seq;
const csvCell = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;

function search(db: MockDb, q: URLSearchParams) {
  const text = q.get("q")?.trim().toLowerCase();
  const actor = q.get("actor_id");
  return db.audit
    .filter((e) => {
      if (actor === "system" && e.actor_id !== null) return false;
      if (actor && actor !== "system" && e.actor_id !== slugOf.user(actor)) return false;
      if (q.get("package_id") && e.package_id !== slugOf.pkg(q.get("package_id")!)) return false;
      if (q.get("from") && e.created_at < q.get("from")!) return false;
      if (q.get("to") && e.created_at > q.get("to")!) return false;
      const who = e.actor_id ? db.user(e.actor_id)?.full_name : "Sistem";
      return (
        !text ||
        [e.message, e.action, e.invoice_number, who].some((x) => x?.toLowerCase().includes(text))
      );
    })
    .sort(newestFirst);
}

export const auditHandlers = (ctx: Ctx) => [
  http.get(
    "*/v1/packages/:package_id/audit",
    route(ctx, ({ request, params }, db) => {
      currentUser(db, request);
      const p = packageOf(db, params.package_id);
      const events = db.audit.filter((e) => e.package_id === p.id).sort(newestFirst);
      return json(
        page(
          events.map((e) => auditEvent(db, e)),
          new URL(request.url),
        ),
      );
    }),
  ),
  http.get(
    "*/v1/audit",
    route(ctx, ({ request }, db) => {
      currentUser(db, request);
      const url = new URL(request.url);
      const events = search(db, url.searchParams);
      if (url.searchParams.get("format") !== "csv")
        return json(
          page(
            events.map((e) => auditEvent(db, e)),
            url,
          ),
        );
      const rows = events.map((e) =>
        [
          e.created_at,
          e.actor_id ? db.user(e.actor_id)?.full_name : "Sistem",
          e.action,
          e.invoice_number,
          e.package_version,
          e.message,
        ]
          .map(csvCell)
          .join(","),
      );
      return new HttpResponse(
        ["created_at,actor,action,invoice_number,package_version,message", ...rows].join("\n") +
          "\n",
        {
          headers: { "Content-Type": "text/csv; charset=utf-8" },
        },
      );
    }),
  ),
];
