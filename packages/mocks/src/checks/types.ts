// Configurable document sets (ADR-0011): the shapes of fixtures/scenarios/*.json and of a generic check result.

export interface SourceQuote {
  page: number;
  quote: string;
}

/** One extracted document. `fields` keys and table columns come from the document type registry. */
export interface GenericDoc {
  id: string;
  type: string;
  file_name: string;
  pages: number;
  fields: Record<string, unknown>;
  /** Top-level field keys the extraction could not read (value is null). */
  unreadable: string[];
  tables: Record<string, Record<string, unknown>[]>;
  /** `field` or `table[i]` → source. Every extracted value has one (fixtures:check). */
  evidence: Record<string, SourceQuote>;
}

export interface GenericPkg {
  id: string;
  reference: string;
  customer_id: string;
  currency: string;
  documents: GenericDoc[];
}

export interface FieldRef {
  document_type: string;
  field: string;
}

export interface CheckConfig {
  id: string;
  type: string;
  title: string;
  parameters: Record<string, unknown>;
}

export interface DocumentRequirement {
  type: string;
  min_count: number;
  max_count: number | null;
}

export type PlaceholderSource =
  | { kind: "field"; document_type: string; field: string }
  | { kind: "aggregate"; op: "sum" | "count"; document_type: string; field?: string }
  | { kind: "approval"; value: "approver_name" | "approved_on" }
  | { kind: "package"; value: "reference" };

export interface GenericRequirementSet {
  version: number;
  documents: DocumentRequirement[];
  checks: CheckConfig[];
  output: {
    template: { file_name: string; sha256: string };
    placeholders: { placeholder: string; source: PlaceholderSource }[];
    submission: { channel: "email"; address: string };
  } | null;
}

export type Outcome = "PASS" | "FAIL" | "UNKNOWN" | "NOT_APPLICABLE";

export interface EvidenceRef extends SourceQuote {
  document_id: string;
  /** `seller`, `lines[0]`, `transactions[2]` — the cited location in the document. */
  field: string;
}

/** Same shape as the contract's CheckResult, with document ids instead of version uuids. */
export interface GenericResult {
  rule_id: string;
  check_type: string;
  title: string;
  outcome: Outcome;
  cascade: false;
  message: string;
  evidence: EvidenceRef[];
  fix_hint: null;
  data: Record<string, unknown>;
}

/** What a check family returns; `evaluate` adds id, type and title. */
export interface Verdict {
  outcome: Outcome;
  message: string;
  evidence: EvidenceRef[];
  data?: Record<string, unknown>;
}

export interface EvalContext {
  /** The customer's other packages (no_duplicate_use with scope `customer`). */
  others: GenericPkg[];
}
