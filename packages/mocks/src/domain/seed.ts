// Derive the initial audit trail and per-package state from fixtures — port of the prototype's reset().
import { documentTypeLabel } from "@payproof/api-client/i18n";
import { rulesFor } from "../engine";
import { info } from "../engine/status";
import { MockDb, utc, type MockDbOptions } from "../store";
import { log } from "./audit";

const addMin = (iso: string, m: number) =>
  utc(new Date(Date.parse(iso) + m * 60_000).toISOString());

export function seed(db: MockDb): MockDb {
  for (const p of db.packages) {
    const pkg = p.id;
    const c = db.customer(p.customer_id);
    log(db, {
      actor: p.owner_id,
      action: "package.created",
      message: `${p.invoice_number} · ${c.name}`,
      pkg,
      at: p.created_at,
    });
    for (const d of p.documents)
      for (const v of d.versions)
        log(db, {
          actor: v.uploaded_by,
          action: "document.uploaded",
          message: `${documentTypeLabel[d.type]}: ${v.file_name} (sənəd v${v.version_no})`,
          pkg,
          objectType: "document_version",
          at: v.uploaded_at,
        });
    if (p.processing) continue;
    const unreadable = p.invoice.unreadable_fields.length > 0;
    log(db, {
      actor: "system",
      action: "document.extracted",
      pkg,
      at: addMin(p.created_at, 2),
      message: unreadable
        ? "Skan: PO sahəsi oxunmadı — insan yoxlaması tələb olunur"
        : "Sahələr və mənbə istinadları çıxarıldı (əvvəlcədən hazırlanmış nəticə)",
    });
    const l = p.order_link;
    if (l.confirmed)
      log(db, {
        actor: l.confirmed_by,
        action: l.method === "exact_id" ? "link.exact_match" : "link.confirmed",
        pkg,
        objectType: "order_link",
        at: addMin(p.created_at, 4),
        message: `${l.po_number} · üsul: ${l.method === "exact_id" ? "təsdiqlənmiş ID" : "insan təsdiqi"}`,
      });
    else if (p.candidates.length)
      log(db, {
        actor: "system",
        action: "link.candidates_found",
        pkg,
        at: addMin(p.created_at, 3),
        message: `${p.candidates.map((x) => x.po_number).join(", ")} — insan seçimi gözlənilir`,
      });
    for (const a of p.approvals) {
      log(db, {
        actor: a.approver_id,
        action: "approval.created",
        pkg,
        objectType: "approval",
        at: a.created_at,
        message: `v${a.package_version} · qayda dəsti v${a.requirement_set_version}`,
      });
      if (!a.valid && a.invalidated_at)
        log(db, {
          actor: "system",
          action: "approval.invalidated",
          pkg,
          objectType: "approval",
          at: a.invalidated_at,
          message: `v${a.package_version} təsdiqi qüvvədən düşdü: ${a.invalidated_reason?.toLowerCase()}. Əvvəlki təsdiq auditdə saxlanılır.`,
        });
    }
    for (const e of p.exports)
      log(db, {
        actor: e.created_by,
        action: "export.created",
        pkg,
        objectType: "export",
        at: e.created_at,
        message: `v${e.package_version} · manifest: ${e.files.join(", ")}`,
      });
  }
  for (const t of db.tasks) {
    log(db, {
      actor: t.created_by,
      action: "task.created",
      pkg: t.package_id,
      objectType: "task",
      at: t.created_at,
      message: `${t.number} · ${t.rule_id} · məsul: ${db.user(t.assignee_id)?.full_name}`,
    });
    if (t.resolved_at)
      log(db, {
        actor: "system",
        action: "task.resolved",
        pkg: t.package_id,
        objectType: "task",
        at: t.resolved_at,
        message: `${t.number}: ${t.rule_id} yoxlaması keçdi`,
      });
  }
  for (const p of db.packages) {
    if (p.processing) continue;
    const i = info(db, p);
    p.last_status = i.status;
    if (i.status === "NEEDS_FIX" || i.status === "NEEDS_REVIEW") p.problem_since = p.created_at;
    const at = p.exports[0]?.created_at ?? p.approvals[0]?.created_at ?? addMin(p.created_at, 6);
    const n = i.counts;
    log(db, {
      actor: "system",
      action: "validation.run",
      pkg: p.id,
      objectType: "validation_run",
      at: addMin(at, -3),
      message: `v${p.version} · qayda dəsti v${rulesFor(db, p).version} · ${n.pass} keçdi, ${n.fail} uyğunsuz, ${n.unknown} naməlum, ${n.not_applicable} tətbiq olunmur`,
    });
  }
  db.audit.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.seq - b.seq);
  db.audit.forEach((e, i) => (e.seq = i + 1));
  for (const p of db.packages)
    p.updated_at = db.audit.filter((e) => e.package_id === p.id).at(-1)!.created_at;
  return db;
}

/** Store with fixtures + derived audit trail — what the MSW handlers serve. */
export const createDemoDb = (options?: MockDbOptions) => seed(new MockDb(options));
