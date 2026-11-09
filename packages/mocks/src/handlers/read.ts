// Read endpoints: dashboard, package list (filters, sorting, paging), package detail, order candidates.
import { http } from "msw";
import { info } from "../engine/status";
import { cents } from "../money";
import { id, slugOf } from "../ids";
import { dashboard, listItem, live } from "../views/overview";
import { packageDetail } from "../views/detail";
import { orderTotal } from "../views/records";
import type { MockDb } from "../store";
import type { Pkg } from "../types";
import { currentUser, json, packageOf, page, route, type Ctx } from "./http";

const STATUS_ORDER = [
  "NEEDS_FIX",
  "NEEDS_REVIEW",
  "PROCESSING",
  "READY_FOR_APPROVAL",
  "APPROVED_READY",
  "EXPORTED",
];

function filterPackages(db: MockDb, q: URLSearchParams) {
  // contract form is status=A,B; repeated status=A&status=B is accepted too
  const statuses = q
    .getAll("status")
    .flatMap((s) => s.split(","))
    .filter(Boolean);
  const customer = q.get("customer_id") && slugOf.customer(q.get("customer_id")!);
  const owner = q.get("owner_id") && slugOf.user(q.get("owner_id")!);
  const text = q.get("q")?.trim().toLowerCase();
  const rows = live(db).map((p) => ({ p, i: info(db, p) }));
  return rows.filter(({ p, i }) => {
    if (statuses.length && !statuses.includes(i.status)) return false;
    if (q.get("customer_id") && p.customer_id !== customer) return false;
    if (q.get("owner_id") && p.owner_id !== owner) return false;
    if (q.get("issue") && !i.primary.some((c) => c.rule_id === q.get("issue"))) return false;
    if (q.get("from") && p.invoice_date < q.get("from")!) return false;
    if (q.get("to") && p.invoice_date > q.get("to")!) return false;
    const hay = [
      p.invoice_number,
      db.customer(p.customer_id).name,
      p.invoice.po_ref,
      p.order_link.po_number,
      p.delivery?.note_number,
    ];
    return !text || hay.some((x) => x?.toLowerCase().includes(text));
  });
}

function sortKey(
  db: MockDb,
  { p, i }: { p: Pkg; i: ReturnType<typeof info> },
  key: string,
): string | number {
  switch (key) {
    case "invoice_number":
      return p.invoice_number;
    case "customer":
      return db.customer(p.customer_id).name;
    case "invoice_date":
      return p.invoice_date;
    case "total":
      return `${p.currency}${String(cents(p.invoice.total)).padStart(15, "0")}`;
    case "status":
      return STATUS_ORDER.indexOf(i.status);
    case "blocking":
      return i.primary.length;
    case "owner":
      return db.user(p.owner_id)!.full_name;
    case "problem_age":
      return p.problem_since ? -Date.parse(p.problem_since) : -Infinity;
    default:
      return p.updated_at;
  }
}

export const readHandlers = (ctx: Ctx) => [
  http.get(
    "*/v1/dashboard",
    route(ctx, ({ request }, db) => (currentUser(db, request), json(dashboard(db)))),
  ),
  http.get(
    "*/v1/packages",
    route(ctx, ({ request }, db) => {
      currentUser(db, request);
      const url = new URL(request.url);
      const sort = url.searchParams.get("sort") ?? "-updated_at";
      const dir = sort.startsWith("-") ? -1 : 1;
      const key = sort.replace(/^-/, "");
      const rows = filterPackages(db, url.searchParams).sort((a, b) => {
        const x = sortKey(db, a, key),
          y = sortKey(db, b, key);
        return (x > y ? 1 : x < y ? -1 : 0) * dir;
      });
      return json({
        ...page(
          rows.map((r) => listItem(db, r.p)),
          url,
        ),
        total_count: rows.length,
      });
    }),
  ),
  http.get(
    "*/v1/packages/:package_id",
    route(ctx, ({ request, params }, db) => {
      const user = currentUser(db, request); // 401 before 404: do not reveal which ids exist
      return json(packageDetail(db, packageOf(db, params.package_id), user.id));
    }),
  ),
  http.get(
    "*/v1/packages/:package_id/match-candidates",
    route(ctx, ({ request, params }, db) => {
      currentUser(db, request);
      const p = packageOf(db, params.package_id);
      return json({
        items: p.candidates.map((c) => {
          const o = db.orders[c.po_number]!;
          return {
            order_id: id.order(c.po_number),
            po_number: c.po_number,
            order_date: o.order_date,
            total: orderTotal(o),
            reason: c.reason,
          };
        }),
      });
    }),
  ),
];
