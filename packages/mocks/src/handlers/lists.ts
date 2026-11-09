// Read endpoints: customers + requirement history, tasks (with tab counts), notifications.
import { http } from "msw";
import { slugOf } from "../ids";
import { customer, notification, requirementSet, task } from "../views/records";
import { currentUser, json, notFound, page, route, type Ctx } from "./http";

export const listHandlers = (ctx: Ctx) => [
  http.get(
    "*/v1/customers",
    route(
      ctx,
      ({ request }, db) => (
        currentUser(db, request),
        json({ items: db.customers.map((c) => customer(db, c)) })
      ),
    ),
  ),
  http.get(
    "*/v1/customers/:customer_id/requirements",
    route(ctx, ({ request, params }, db) => {
      currentUser(db, request);
      const c = db.customers.find((x) => x.id === slugOf.customer(String(params.customer_id)));
      if (!c) throw notFound();
      return json({
        items: [...c.requirement_sets].reverse().map((r) => requirementSet(db, c, r)),
      });
    }),
  ),
  http.get(
    "*/v1/tasks",
    route(ctx, ({ request }, db) => {
      currentUser(db, request);
      const url = new URL(request.url);
      const q = url.searchParams;
      const status = q.get("status") ?? "active";
      const scoped = db.tasks.filter(
        (t) =>
          (!q.get("assignee_id") || t.assignee_id === slugOf.user(q.get("assignee_id")!)) &&
          (!q.get("package_id") || t.package_id === slugOf.pkg(q.get("package_id")!)) &&
          !db.pkg(t.package_id).deleted,
      );
      const status_counts = { OPEN: 0, IN_PROGRESS: 0, SUBMITTED_FOR_RECHECK: 0, RESOLVED: 0 };
      for (const t of scoped) status_counts[t.status]++;
      const shown = scoped
        .filter((t) => (status === "active" ? t.status !== "RESOLVED" : t.status === status))
        .sort(
          (a, b) =>
            Number(a.status === "RESOLVED") - Number(b.status === "RESOLVED") ||
            a.due_date.localeCompare(b.due_date),
        );
      return json({
        ...page(
          shown.map((t) => task(db, t)),
          url,
        ),
        status_counts,
      });
    }),
  ),
  http.get(
    "*/v1/notifications",
    route(ctx, ({ request }, db) => {
      const me = currentUser(db, request);
      const url = new URL(request.url);
      const mine = db.notifications
        .filter((n) => n.user_id === me.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.seq - a.seq);
      const shown =
        url.searchParams.get("unread_only") === "true" ? mine.filter((n) => !n.read) : mine;
      return json({
        ...page(
          shown.map((n) => notification(db, n)),
          url,
        ),
        unread_count: mine.filter((n) => !n.read).length,
      });
    }),
  ),
];
