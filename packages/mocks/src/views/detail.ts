// PackageDetail — everything the package screen needs, for one viewer (permissions = role AND state).
import type { Schemas } from "@payproof/api-client";
import { rulesFor } from "../engine";
import { currentApproval, info } from "../engine/status";
import { id } from "../ids";
import { can } from "../permissions";
import type { MockDb } from "../store";
import type { Pkg } from "../types";
import { comparison } from "./comparison";
import { checkResult, documents, fields } from "./documents";
import {
  approval,
  customerRef,
  exportRecord,
  orderTotal,
  requirementSet,
  task,
  userRef,
} from "./records";

export function packageDetail(db: MockDb, p: Pkg, viewer: string): Schemas["PackageDetail"] {
  const i = info(db, p);
  const user = db.user(viewer);
  const link = p.order_link;
  const current = currentApproval(db, p);
  const deletable =
    !p.approvals.length && ["PROCESSING", "NEEDS_FIX", "NEEDS_REVIEW"].includes(i.status);
  return {
    id: id.pkg(p.id),
    invoice_number: p.invoice_number,
    version: p.version,
    status: i.status,
    processing: p.processing,
    customer: customerRef(db, p.customer_id),
    invoice_date: p.invoice_date,
    owner: userRef(db, p.owner_id),
    created_at: p.created_at,
    updated_at: p.updated_at,
    total: { amount: p.invoice.total, currency: p.currency },
    requirement_set: requirementSet(db, db.customer(p.customer_id), rulesFor(db, p)),
    link: {
      confirmed: link.confirmed,
      order_id: link.confirmed && link.po_number ? id.order(link.po_number) : null,
      order_po: link.confirmed ? link.po_number : null,
      method: link.method,
      confirmed_by:
        link.confirmed_by && link.confirmed_by !== "system" ? userRef(db, link.confirmed_by) : null,
      candidates: p.candidates.map((c) => {
        const o = db.orders[c.po_number]!;
        return {
          order_id: id.order(c.po_number),
          po_number: c.po_number,
          order_date: o.order_date,
          total: orderTotal(o),
          reason: c.reason,
        };
      }),
    },
    documents: documents(db, p),
    fields: fields(db, p),
    comparison: { rows: p.processing ? [] : comparison(db, p) },
    checks: i.checks.map((c) => checkResult(p, c)),
    summary: {
      ...i.counts,
      blocking: i.primary.map((c) => ({
        rule_id: c.rule_id,
        outcome: c.outcome as "FAIL" | "UNKNOWN",
      })),
    },
    current_approval: current ? approval(db, p, current) : null,
    approvals: p.approvals.map((a) => approval(db, p, a)),
    exports: p.exports.map((e) => exportRecord(db, p, e)),
    tasks: db.tasks.filter((t) => t.package_id === p.id).map((t) => task(db, t)),
    permissions: {
      can_edit: can(user, "EDIT_PACKAGE") && !p.processing,
      can_manage_tasks: can(user, "MANAGE_TASKS"),
      can_approve: can(user, "APPROVE_PACKAGE") && i.status === "READY_FOR_APPROVAL",
      can_export: can(user, "EXPORT_PACKAGE") && i.status === "APPROVED_READY",
      can_delete: can(user, "DELETE_PACKAGE") && deletable,
    },
  };
}
