// Version bump (invalidates approvals) and re-validation (auto-resolves tasks) — prototype bump()/validate().
import { formatMoney } from "@payproof/api-client/format";
import { info, type Info } from "../engine/status";
import { rulesFor } from "../engine";
import type { MockDb } from "../store";
import type { Pkg } from "../types";
import { approvers, log, notify } from "./audit";

export function bump(db: MockDb, p: Pkg, reason: string) {
  p.version++;
  for (const a of p.approvals) {
    if (!a.valid || a.package_version >= p.version) continue;
    a.valid = false;
    a.invalidated_reason = reason;
    a.invalidated_at = db.nowIso();
    log(db, {
      actor: "system",
      action: "approval.invalidated",
      message: `v${a.package_version} təsdiqi qüvvədən düşdü: ${reason}. Əvvəlki təsdiq auditdə saxlanılır.`,
      pkg: p.id,
      objectType: "approval",
      details: { approval_version: a.package_version },
    });
    notify(
      db,
      a.approver_id,
      p.id,
      `${p.invoice_number}: ${reason}. v${a.package_version} təsdiqi etibarsızlaşdı — v${p.version} yenidən təsdiq tələb edir.`,
    );
  }
}

const summary = (c: Info["counts"]) =>
  `${c.pass} keçdi, ${c.fail} uyğunsuz, ${c.unknown} naməlum, ${c.not_applicable} tətbiq olunmur`;

/** Re-run the engine for the current version; the only place tasks become RESOLVED. */
export function validate(db: MockDb, p: Pkg, actor = "system"): Info {
  const i = info(db, p);
  log(db, {
    actor,
    action: "validation.run",
    message: `v${p.version} · qayda dəsti v${rulesFor(db, p).version} · ${summary(i.counts)}`,
    pkg: p.id,
    objectType: "validation_run",
  });
  for (const t of db.tasks.filter((x) => x.package_id === p.id && x.status !== "RESOLVED")) {
    const outcome = i.checks.find((c) => c.rule_id === t.rule_id)?.outcome;
    if (outcome === "PASS" || outcome === "NOT_APPLICABLE") {
      t.status = "RESOLVED";
      t.resolved_at = db.nowIso();
      log(db, {
        actor: "system",
        action: "task.resolved",
        message: `${t.number}: ${t.rule_id} yoxlaması keçdi`,
        pkg: p.id,
        objectType: "task",
      });
    } else if (t.status === "SUBMITTED_FOR_RECHECK") {
      t.status = "IN_PROGRESS";
      log(db, {
        actor: "system",
        action: "task.reopened",
        message: `${t.number}: ${t.rule_id} hələ keçmir`,
        pkg: p.id,
        objectType: "task",
      });
    }
  }
  if (i.status !== p.last_status) {
    if (i.status === "READY_FOR_APPROVAL")
      for (const u of approvers(db))
        notify(
          db,
          u,
          p.id,
          `${p.invoice_number} təsdiqinizi gözləyir · ${formatMoney(p.invoice.total, p.currency)}`,
        );
    p.last_status = i.status;
  }
  const problem = i.status === "NEEDS_FIX" || i.status === "NEEDS_REVIEW";
  p.problem_since = problem ? (p.problem_since ?? db.nowIso()) : null;
  p.updated_at = db.nowIso();
  return i;
}
