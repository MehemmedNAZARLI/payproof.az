// New customer requirement set (approver only), notifications read, demo reset.
import { http, HttpResponse } from "msw";
import { MockError } from "../domain/audit";
import { saveRequirements } from "../domain/rules";
import { id, slugOf } from "../ids";
import { requirementSet } from "../views/records";
import {
  body,
  currentUser,
  json,
  notFound,
  requirePermission,
  required,
  route,
  type Ctx,
} from "./http";

const noContent = () => new HttpResponse(null, { status: 204 });

export const settingsHandlers = (ctx: Ctx) => [
  http.post(
    "*/v1/customers/:customer_id/requirements",
    route(ctx, async ({ request, params }, db) => {
      const user = currentUser(db, request);
      requirePermission(user, "MANAGE_REQUIREMENTS");
      const c = db.customers.find((x) => x.id === slugOf.customer(String(params.customer_id)));
      if (!c) throw notFound();
      const b = await body(request);
      const current = c.requirement_sets.at(-1)!.version;
      if (b.expected_version !== current)
        throw new MockError("VERSION_CONFLICT", `Qayda dəsti v${current}-ə yenilənib.`, 409, {
          current_version: current,
        });
      const reason = required(b.reason, "reason");
      const tolerance = required(b.tolerance, "tolerance");
      if (reason.trim().length < 10)
        throw new MockError("VALIDATION_ERROR", "Səbəb ən azı 10 simvol olmalıdır.", 422, {
          fields: { reason: "Ən azı 10 simvol." },
        });
      if (!/^(0\.\d{2}|1\.00)$/.test(tolerance))
        throw new MockError("VALIDATION_ERROR", "Tolerans 0,00–1,00 aralığında olmalıdır.", 422, {
          fields: { tolerance: "0.00–1.00" },
        });
      const flags = ["require_po", "require_delivery", "require_signature"] as const;
      if (flags.some((k) => typeof b[k] !== "boolean"))
        throw new MockError("VALIDATION_ERROR", "Qayda sahələri məcburidir.", 422);
      const set = saveRequirements(
        db,
        c,
        {
          require_po: b.require_po as boolean,
          require_delivery: b.require_delivery as boolean,
          require_signature: b.require_signature as boolean,
          tolerance,
          effective_from: required(b.effective_from, "effective_from"),
          reason,
        },
        user.id,
      );
      return json(requirementSet(db, c, set), 201);
    }),
  ),
  http.post(
    "*/v1/notifications/:notification_id/read",
    route(ctx, ({ request, params }, db) => {
      const me = currentUser(db, request);
      const n = db.notifications.find(
        (x) => id.notification(x.seq) === params.notification_id && x.user_id === me.id,
      );
      if (!n) throw notFound();
      n.read = true;
      return noContent();
    }),
  ),
  http.post(
    "*/v1/notifications/read-all",
    route(ctx, ({ request }, db) => {
      const me = currentUser(db, request);
      for (const n of db.notifications) if (n.user_id === me.id) n.read = true;
      return noContent();
    }),
  ),
  http.post(
    "*/v1/demo/reset",
    route(ctx, ({ request }, db) => {
      currentUser(db, request);
      ctx.reset();
      return noContent();
    }),
  ),
];
