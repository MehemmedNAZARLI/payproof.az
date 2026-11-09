// Internal mock state — fixture shapes (fixtures/schema) made mutable. Slugs as ids; serializers map to UUIDs.
import type { DocType } from "./ids";

export type Currency = "AZN" | "USD";
export interface PricedLine {
  product_code: string;
  qty: number;
  unit_price: string;
  /** Unit as read; absent = the product's unit, null = not read. */
  unit?: string | null;
}
export interface QtyLine {
  product_code: string;
  qty: number;
}
export interface RequirementSet {
  version: number;
  require_po: boolean;
  require_delivery: boolean;
  require_signature: boolean;
  tolerance: string;
  effective_from: string;
  approved_by: string;
  reason: string;
}
export interface Customer {
  id: string;
  name: string;
  external_id: string;
  voen: string;
  requirement_sets: RequirementSet[];
}
export interface User {
  id: string;
  email: string;
  full_name: string;
  title: string;
  role: "operator" | "approver" | "readonly" | "admin" | "assignee";
  demo_login: boolean;
}
export interface Order {
  po_number: string;
  customer_id: string;
  currency: Currency;
  order_date: string;
  lines: PricedLine[];
}
export interface Delivery {
  note_number: string;
  po_ref: string;
  customer_id: string;
  delivery_date: string;
  signed: boolean;
  lines: QtyLine[];
}
export interface DocVersion {
  version_no: number;
  file_name: string;
  sha256: string;
  source_kind: "pdf" | "scan" | "spreadsheet";
  uploaded_by: string;
  uploaded_at: string;
  status: "UPLOADED" | "PROCESSING" | "EXTRACTED" | "REVIEW_REQUIRED" | "FAILED";
  package_version_at_upload: number;
  signed?: boolean;
}
export interface Approval {
  package_version: number;
  requirement_set_version: number;
  approver_id: string;
  created_at: string;
  valid: boolean;
  invalidated_reason: string | null;
  invalidated_at: string | null;
}
export interface ExportRec {
  package_version: number;
  requirement_set_version: number;
  created_by: string;
  created_at: string;
  files: string[];
}
export interface Pkg {
  id: string;
  invoice_number: string;
  customer_id: string;
  currency: Currency;
  invoice_date: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
  version: number;
  processing: boolean;
  invoice: {
    po_ref: string | null;
    po_raw: string | null;
    unreadable_fields: string[];
    total: string;
    lines: PricedLine[];
  };
  order_link: {
    po_number: string | null;
    confirmed: boolean;
    confirmed_by: string | null;
    method: "exact_id" | "human" | null;
  };
  candidates: { po_number: string; reason: string }[];
  delivery: Delivery | null;
  signature_reviewed: boolean;
  documents: { type: DocType; versions: DocVersion[] }[];
  approvals: Approval[];
  exports: ExportRec[];
  problem_since: string | null;
  last_status: string | null;
  /** Manual extraction corrections by field path (`invoice.po_ref`, `invoice.lines[KY-10].qty`). */
  corrections?: Record<string, { from: string; to: string; reason: string; by: string }>;
  deleted?: boolean;
}
/** Rule-engine input: a Pkg whose extracted values may be unread (null), like the API's PackageSnapshot.
 * shortcut: the store never holds these nulls yet (only po_ref, via unreadable_fields); widen Pkg once extraction can leave values unread. */
export type EnginePkg = Omit<Pkg, "invoice" | "delivery"> & {
  invoice: Omit<Pkg["invoice"], "total" | "lines"> & {
    total: string | null;
    lines: (Omit<PricedLine, "qty" | "unit_price"> & {
      qty: number | null;
      unit_price: string | null;
    })[];
  };
  delivery:
    | (Omit<Delivery, "note_number" | "po_ref" | "customer_id" | "signed" | "lines"> & {
        note_number: string | null;
        po_ref: string | null;
        customer_id: string | null;
        signed: boolean | null;
        lines: { product_code: string; qty: number | null }[];
      })
    | null;
};
export interface Task {
  number: string;
  package_id: string;
  rule_id: string;
  assignee_id: string;
  step: string;
  due_date: string;
  status: "OPEN" | "IN_PROGRESS" | "SUBMITTED_FOR_RECHECK" | "RESOLVED";
  created_at: string;
  created_by: string;
  comment: string | null;
  resolved_at: string | null;
}
export interface Notification {
  seq: number;
  user_id: string;
  package_id: string | null;
  text: string;
  created_at: string;
  read: boolean;
}
export interface AuditEvent {
  seq: number;
  created_at: string;
  actor_id: string | null;
  action: string;
  message: string;
  package_id: string | null;
  invoice_number: string | null;
  package_version: number | null;
  object_type: string;
  object_id: string | null;
  details: Record<string, unknown>;
}
export interface Sample {
  id: string;
  package_id: string;
  type: "invoice" | "delivery";
  file_name: string;
  sha256: string;
  note: string;
  extraction: {
    po_ref?: string;
    currency?: Currency;
    line?: { product_code: string; unit_price?: string; qty?: number };
    delivery?: { note_number: string; po_ref: string; signed: boolean };
  };
}
