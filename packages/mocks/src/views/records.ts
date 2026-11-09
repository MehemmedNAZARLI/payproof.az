// Contract serializers for users, customers and records. Return types are the generated contract types.
import type { Schemas } from "@payproof/api-client";
import company from "../../../../fixtures/company.json";
import { id } from "../ids";
import { sumLines, decimal } from "../money";
import { ROLE_PERMISSIONS } from "../permissions";
import type { MockDb } from "../store";
import type * as T from "../types";

export const userRef = (db: MockDb, slug: string): Schemas["UserRef"] => {
  const u = db.user(slug)!;
  return { id: id.user(u.id), full_name: u.full_name, title: u.title, role: u.role };
};
export const pkgRef = (db: MockDb, slug: string): Schemas["PackageRef"] => ({
  id: id.pkg(slug),
  invoice_number: db.packages.find((p) => p.id === slug)?.invoice_number ?? "",
});
export const customerRef = (db: MockDb, slug: string): Schemas["CustomerRef"] => ({
  id: id.customer(slug),
  name: db.customer(slug).name,
});
export const orderTotal = (o: T.Order): Schemas["Money"] => ({
  amount: decimal(sumLines(o.lines)),
  currency: o.currency,
});

export const me = (db: MockDb, slug: string): Schemas["Me"] => {
  const u = db.user(slug)!;
  return {
    id: id.user(u.id),
    email: u.email,
    full_name: u.full_name,
    title: u.title,
    role: u.role,
    company: { id: id.company(), name: company.name, voen: company.voen },
    permissions: [...ROLE_PERMISSIONS[u.role]],
  };
};

export const requirementSet = (
  db: MockDb,
  c: T.Customer,
  r: T.RequirementSet,
): Schemas["RequirementSet"] => ({
  id: id.ruleSet(c.id, r.version),
  version: r.version,
  require_po: r.require_po,
  require_delivery: r.require_delivery,
  require_signature: r.require_signature,
  tolerance: r.tolerance,
  effective_from: r.effective_from,
  approved_by: userRef(db, r.approved_by),
  reason: r.reason,
  created_at: `${r.effective_from}T00:00:00Z`,
});

export const customer = (db: MockDb, c: T.Customer): Schemas["Customer"] => ({
  id: id.customer(c.id),
  name: c.name,
  external_id: c.external_id,
  voen: c.voen,
  current_requirements: requirementSet(db, c, c.requirement_sets[c.requirement_sets.length - 1]!),
});

export const task = (db: MockDb, t: T.Task): Schemas["Task"] => ({
  id: id.task(t.number),
  number: t.number,
  package: pkgRef(db, t.package_id),
  rule_id: t.rule_id,
  assignee: userRef(db, t.assignee_id),
  step: t.step,
  due_date: t.due_date,
  status: t.status,
  comment: t.comment,
  created_at: t.created_at,
  created_by: userRef(db, t.created_by),
  resolved_at: t.resolved_at,
});

export const approval = (db: MockDb, p: T.Pkg, a: T.Approval): Schemas["ApprovalRecord"] => ({
  id: id.approval(p.id, a.package_version),
  package_version: a.package_version,
  requirement_set_version: a.requirement_set_version,
  approver: userRef(db, a.approver_id),
  approved_at: a.created_at,
  valid: a.valid,
  invalidated_reason: a.invalidated_reason,
  invalidated_at: a.invalidated_at,
});

/** Export files are matched to the document versions with that file name. */
export const exportRecord = (db: MockDb, p: T.Pkg, e: T.ExportRec): Schemas["ExportRecord"] => ({
  id: id.export(p.id, e.package_version),
  package_version: e.package_version,
  requirement_set_version: e.requirement_set_version,
  created_by: userRef(db, e.created_by),
  created_at: e.created_at,
  files: e.files.map((file_name) => {
    const d = p.documents.find((x) => x.versions.some((v) => v.file_name === file_name))!;
    const ver = d.versions.find((v) => v.file_name === file_name)!;
    return {
      document_version_id: id.version(p.id, d.type, ver.version_no),
      type: d.type,
      file_name,
    };
  }),
});

export const auditEvent = (db: MockDb, e: T.AuditEvent): Schemas["AuditEvent"] => ({
  id: id.audit(e.seq),
  created_at: e.created_at,
  actor: e.actor_id ? userRef(db, e.actor_id) : null,
  action: e.action,
  message: e.message,
  package: e.package_id ? pkgRef(db, e.package_id) : null,
  package_version: e.package_version,
  object_type: e.object_type,
  object_id: e.object_id,
  details: e.details,
});

export const notification = (db: MockDb, n: T.Notification): Schemas["Notification"] => ({
  id: id.notification(n.seq),
  text: n.text,
  package: n.package_id ? pkgRef(db, n.package_id) : null,
  created_at: n.created_at,
  read_at: n.read ? n.created_at : null,
});
