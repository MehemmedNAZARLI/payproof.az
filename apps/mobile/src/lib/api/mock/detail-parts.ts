import customers from "@fixtures/customers.json";
import orders from "@fixtures/orders.json";
import tasks from "@fixtures/tasks.json";
import type { Schemas } from "@payproof/api-client";

import { decimal, toCents } from "@/lib/money";

import type { FixturePackage } from "./engine/model";
import { toUtc, userRef } from "./store";

// Pieces of the mock PackageDetail that come straight from fixtures (no rule engine).

type Status = Schemas["PackageStatus"];

export const uuid = (space: string, digits: string) =>
  `0193a000-0000-7000-${space}-${digits.padStart(12, "0")}`;
const orderId = (po: string) => uuid("8003", po.replace(/\D/g, ""));

export function requirementSet(p: FixturePackage, version: number): Schemas["RequirementSet"] {
  const c = customers.find((x) => x.id === p.customer_id)!;
  const r = c.requirement_sets.find((s) => s.version === version)!;
  return {
    id: uuid("800d", `${c.id.replace(/\D/g, "")}${String(version).padStart(2, "0")}`),
    version,
    require_po: r.require_po,
    require_delivery: r.require_delivery,
    require_signature: r.require_signature,
    tolerance: r.tolerance,
    effective_from: r.effective_from,
    approved_by: userRef(r.approved_by),
    reason: r.reason,
    // Rule sets are agreed before they take effect; the fixtures keep only the date.
    created_at: `${r.effective_from}T00:00:00Z`,
  };
}

export function link(p: FixturePackage): Schemas["OrderLink"] {
  const l = p.order_link;
  const confirmed = l.confirmed && l.po_number !== null;
  return {
    confirmed,
    order_id: confirmed ? orderId(l.po_number!) : null,
    order_po: confirmed ? l.po_number : null,
    method: l.method as Schemas["OrderLink"]["method"],
    confirmed_by: l.confirmed_by && l.confirmed_by !== "system" ? userRef(l.confirmed_by) : null,
    candidates: p.candidates.map((c) => {
      const o = orders.find((x) => x.po_number === c.po_number)!;
      const total = o.lines.reduce((sum, x) => sum + toCents(x.unit_price) * BigInt(x.qty), 0n);
      return {
        order_id: orderId(o.po_number),
        po_number: o.po_number,
        order_date: o.order_date,
        total: { amount: decimal(total), currency: o.currency as Schemas["Currency"] },
        reason: c.reason,
      };
    }),
  };
}

export function packageTasks(p: FixturePackage, ref: Schemas["PackageRef"]): Schemas["Task"][] {
  return tasks
    .filter((x) => x.package_id === p.id)
    .map((x) => ({
      id: uuid("8006", x.number.replace(/\D/g, "")),
      number: x.number,
      package: ref,
      rule_id: x.rule_id as Schemas["RuleId"],
      assignee: userRef(x.assignee_id),
      step: x.step,
      due_date: x.due_date,
      status: x.status as Schemas["TaskStatus"],
      comment: x.comment,
      created_at: toUtc(x.created_at),
      created_by: userRef(x.created_by),
      resolved_at: x.resolved_at && toUtc(x.resolved_at),
    }));
}

/** Role permission AND state, as the contract's PackagePermissions describes them. */
export function permissions(status: Status, everApproved: boolean, user: Schemas["Me"]) {
  const has = (perm: Schemas["Permission"]) => user.permissions.includes(perm);
  const open = status === "PROCESSING" || status === "NEEDS_REVIEW" || status === "NEEDS_FIX";
  return {
    can_edit: has("EDIT_PACKAGE") && status !== "PROCESSING" && status !== "EXPORTED",
    can_manage_tasks: has("MANAGE_TASKS"),
    can_approve: has("APPROVE_PACKAGE") && status === "READY_FOR_APPROVAL",
    can_export: has("EXPORT_PACKAGE") && status === "APPROVED_READY",
    can_delete: has("DELETE_PACKAGE") && open && !everApproved,
  };
}
