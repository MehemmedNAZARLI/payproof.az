// Version-bound approval and idempotent export (state-machines.md). Role and expected_version are checked
// by the HTTP layer first; here: existing → return it, wrong state → PACKAGE_NOT_READY.
import { currentApproval, info } from "../engine/status";
import { rulesFor } from "../engine";
import type { MockDb } from "../store";
import type { Approval, ExportRec, Pkg } from "../types";
import { log, MockError, notify } from "./audit";

const notReady = (db: MockDb, p: Pkg, message: string) => {
  const i = info(db, p);
  return new MockError("PACKAGE_NOT_READY", message, 409, {
    status: i.status,
    blocking: i.primary.map((c) => c.rule_id),
  });
};

export function approvePackage(
  db: MockDb,
  p: Pkg,
  actor: string,
): { approval: Approval; created: boolean } {
  const existing = currentApproval(db, p);
  if (existing) return { approval: existing, created: false };
  const i = info(db, p);
  if (i.status !== "READY_FOR_APPROVAL")
    throw notReady(db, p, "Bloklayan və ya naməlum yoxlama var — paket təsdiqlənə bilməz.");
  const rv = rulesFor(db, p).version;
  const approval: Approval = {
    package_version: p.version,
    requirement_set_version: rv,
    approver_id: actor,
    created_at: db.tick(),
    valid: true,
    invalidated_reason: null,
    invalidated_at: null,
  };
  p.approvals.push(approval);
  log(db, {
    actor,
    action: "approval.created",
    objectType: "approval",
    pkg: p.id,
    message: `v${p.version} · qayda dəsti v${rv} · ${i.counts.pass} yoxlama keçdi. Bu, ödəniş təsdiqi deyil.`,
  });
  notify(
    db,
    p.owner_id,
    p.id,
    `${p.invoice_number} ${db.user(actor)?.full_name} tərəfindən təsdiqləndi — paket göndərilməyə hazırdır.`,
  );
  p.last_status = "APPROVED_READY";
  p.problem_since = null;
  p.updated_at = db.nowIso();
  return { approval, created: true };
}

/** `files` = selected current document versions as `{ type, file_name }`; the invoice is mandatory. */
export function exportPackage(
  db: MockDb,
  p: Pkg,
  actor: string,
  files: { type: string; file_name: string }[],
) {
  const existing = p.exports.find((e) => e.package_version === p.version);
  if (existing) return { export: existing, created: false };
  if (info(db, p).status !== "APPROVED_READY")
    throw notReady(db, p, "İxrac üçün cari versiyanın təsdiqi tələb olunur.");
  if (!files.some((f) => f.type === "invoice"))
    throw new MockError("INVOICE_REQUIRED", "İxrac paketində faktura məcburidir.", 422);
  const rec: ExportRec = {
    package_version: p.version,
    requirement_set_version: rulesFor(db, p).version,
    created_by: actor,
    created_at: db.tick(),
    files: files.map((f) => f.file_name),
  };
  p.exports.push(rec);
  log(db, {
    actor,
    action: "export.created",
    objectType: "export",
    pkg: p.id,
    message: `v${p.version} · manifest: ${rec.files.join(", ")}`,
  });
  p.last_status = "EXPORTED";
  p.updated_at = db.nowIso();
  return { export: rec, created: true };
}
