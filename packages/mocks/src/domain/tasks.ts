// Resolution tasks — docs/architecture/state-machines.md. Only the system sets RESOLVED (in validate()).
import { ruleLabel } from "@payproof/api-client/i18n";
import type { MockDb } from "../store";
import type { Pkg, Task } from "../types";
import { log, MockError, notify } from "./audit";
import { validate } from "./validate";

export interface TaskInput {
  rule_id: string;
  assignee_id: string;
  step: string;
  due_date: string;
  comment?: string | null;
}
export type TaskPatch = Partial<
  Pick<Task, "status" | "assignee_id" | "step" | "due_date" | "comment">
>;

const NEXT: Record<string, string | undefined> = {
  OPEN: "IN_PROGRESS",
  IN_PROGRESS: "SUBMITTED_FOR_RECHECK",
};
const notAllowed = (m: string) => new MockError("TASK_STATUS_NOT_ALLOWED", m, 422);
const canSignIn = (db: MockDb, u: string) =>
  !["assignee", "readonly"].includes(db.user(u)?.role ?? "assignee");

export function createTask(db: MockDb, p: Pkg, input: TaskInput, actor: string): Task {
  const open = db.tasks.find(
    (t) => t.package_id === p.id && t.rule_id === input.rule_id && t.status !== "RESOLVED",
  );
  if (open)
    throw new MockError(
      "TASK_ALREADY_OPEN",
      `Bu qayda üçün açıq tapşırıq artıq var: ${open.number}.`,
      409,
      { number: open.number },
    );
  const t: Task = {
    number: `T-${++db.seq.task}`,
    package_id: p.id,
    rule_id: input.rule_id,
    assignee_id: input.assignee_id,
    step: input.step,
    due_date: input.due_date,
    status: "OPEN",
    created_at: db.tick(),
    created_by: actor,
    comment: input.comment ?? null,
    resolved_at: null,
  };
  db.tasks.unshift(t);
  log(db, {
    actor,
    action: "task.created",
    message: `${t.number} · ${t.rule_id} · məsul: ${db.user(t.assignee_id)?.full_name}`,
    pkg: p.id,
    objectType: "task",
  });
  if (t.assignee_id !== actor && canSignIn(db, t.assignee_id))
    notify(
      db,
      t.assignee_id,
      p.id,
      `Yeni tapşırıq ${t.number}: ${p.invoice_number} — ${ruleLabel(t.rule_id)}`,
    );
  return t;
}

export function updateTask(db: MockDb, t: Task, patch: TaskPatch, actor: string): Task {
  if (t.status === "RESOLVED") throw notAllowed("Həll edilmiş tapşırıq dəyişdirilə bilməz.");
  if (patch.status === "RESOLVED")
    throw notAllowed("Tapşırığı yalnız sistem həll edilmiş kimi bağlayır — uyğun qayda keçəndə.");
  const { status, ...rest } = patch;
  const moves = !!status && status !== t.status;
  // validate before touching the task, so a rejected request changes nothing
  if (moves && NEXT[t.status] !== status)
    throw notAllowed(`${t.status} → ${status} keçidi mümkün deyil.`);
  Object.assign(t, rest);
  if (moves && status) {
    t.status = status;
    const p = db.pkg(t.package_id);
    if (status === "IN_PROGRESS")
      log(db, { actor, action: "task.started", message: t.number, pkg: p.id, objectType: "task" });
    else {
      log(db, {
        actor,
        action: "task.submitted",
        message: t.number,
        pkg: p.id,
        objectType: "task",
      });
      if (p.owner_id !== actor)
        notify(
          db,
          p.owner_id,
          p.id,
          `${t.number} yenidən yoxlamaya göndərildi (${p.invoice_number}).`,
        );
      validate(db, p);
    }
  }
  return t;
}

export function cancelTask(db: MockDb, t: Task, actor: string) {
  if (t.status === "RESOLVED") throw notAllowed("Həll edilmiş tapşırıq ləğv edilə bilməz.");
  db.tasks = db.tasks.filter((x) => x !== t);
  log(db, {
    actor,
    action: "task.cancelled",
    message: `${t.number} · ${t.rule_id}`,
    pkg: t.package_id,
    objectType: "task",
  });
}
