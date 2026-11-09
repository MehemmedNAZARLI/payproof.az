// Tasks: create for a package, move forward / reassign, cancel. RESOLVED stays system-only (422).
import { http, HttpResponse } from "msw";
import { MockError } from "../domain/audit";
import { cancelTask, createTask, updateTask, type TaskPatch } from "../domain/tasks";
import { slugOf } from "../ids";
import type { MockDb } from "../store";
import { task } from "../views/records";
import {
  body,
  currentUser,
  json,
  notFound,
  packageOf,
  requirePermission,
  required,
  route,
  type Ctx,
} from "./http";

const bad = (field: string, m: string) =>
  new MockError("VALIDATION_ERROR", "Sorğuda xəta var.", 422, { fields: { [field]: m } });

function assignee(db: MockDb, uuid: unknown): string {
  const slug = typeof uuid === "string" ? slugOf.user(uuid) : null;
  const u = slug ? db.user(slug) : undefined;
  if (!u || u.role === "readonly") throw bad("assignee_id", "Məsul şəxs tapılmadı.");
  return u.id;
}
const date = (v: unknown, field: string) => {
  const s = required(v, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw bad(field, "Tarix YYYY-MM-DD formatında olmalıdır.");
  return s;
};
const taskOf = (db: MockDb, uuid: unknown) => {
  const n = typeof uuid === "string" ? slugOf.task(uuid) : null;
  const t = db.tasks.find((x) => x.number === n && !db.pkg(x.package_id).deleted);
  if (!t) throw notFound();
  return t;
};

export const taskHandlers = (ctx: Ctx) => [
  http.post(
    "*/v1/packages/:package_id/tasks",
    route(ctx, async ({ request, params }, db) => {
      const user = currentUser(db, request);
      requirePermission(user, "MANAGE_TASKS");
      const p = packageOf(db, params.package_id);
      const b = await body(request);
      const rule = required(b.rule_id, "rule_id");
      if (!/^R-00[1-9]$/.test(rule)) throw bad("rule_id", "Naməlum qayda.");
      const step = required(b.step, "step");
      if (step.trim().length < 3) throw bad("step", "Ən azı 3 simvol.");
      const t = createTask(
        db,
        p,
        {
          rule_id: rule,
          assignee_id: assignee(db, b.assignee_id),
          step,
          due_date: date(b.due_date, "due_date"),
          comment: typeof b.comment === "string" ? b.comment : null,
        },
        user.id,
      );
      return json(task(db, t), 201);
    }),
  ),
  http.patch(
    "*/v1/tasks/:task_id",
    route(ctx, async ({ request, params }, db) => {
      const user = currentUser(db, request);
      requirePermission(user, "MANAGE_TASKS");
      const t = taskOf(db, params.task_id);
      const b = await body(request);
      if (!Object.keys(b).length) throw bad("body", "Ən azı bir sahə göndərin.");
      const patch: TaskPatch = {};
      if (b.status !== undefined) {
        if (
          !["OPEN", "IN_PROGRESS", "SUBMITTED_FOR_RECHECK", "RESOLVED"].includes(String(b.status))
        )
          throw bad("status", "Naməlum status.");
        patch.status = b.status as TaskPatch["status"];
      }
      if (b.assignee_id !== undefined) patch.assignee_id = assignee(db, b.assignee_id);
      if (b.due_date !== undefined) patch.due_date = date(b.due_date, "due_date");
      if (b.step !== undefined) patch.step = required(b.step, "step");
      if (b.comment !== undefined) patch.comment = b.comment === null ? null : String(b.comment);
      return json(task(db, updateTask(db, t, patch, user.id)));
    }),
  ),
  http.delete(
    "*/v1/tasks/:task_id",
    route(ctx, ({ request, params }, db) => {
      const user = currentUser(db, request);
      requirePermission(user, "MANAGE_TASKS");
      cancelTask(db, taskOf(db, params.task_id), user.id);
      return new HttpResponse(null, { status: 204 });
    }),
  ),
];
