import expected from "@fixtures/scenarios/unec.expected.json";
import scenario from "@fixtures/scenarios/unec.json";

export type Source = { page: number; quote: string };
export type GrantDocument = {
  id: string;
  type: string;
  file_name: string;
  fields: Record<string, unknown>;
  evidence: Record<string, Source | undefined>;
  unreadable: string[];
  tables: {
    lines?: Record<string, unknown>[];
    transactions?: { date: string; amount: string; direction: string; counterparty: string }[];
  };
};
type Expected = {
  status: "READY_FOR_APPROVAL" | "NEEDS_FIX";
  results: Record<string, "PASS" | "FAIL" | "UNKNOWN" | "NOT_APPLICABLE">;
  data: {
    "U-06": { total: { amount: string; currency: string } };
    "U-07": {
      matches: { document_id: string; transaction: { document_id: string; index: number } }[];
      unmatched: {
        document_id: string;
        amount: { amount: string; currency: string };
        nearest: {
          amount: { amount: string; currency: string };
          difference: { amount: string; currency: string };
        };
      }[];
    };
  };
  template_values?: Record<string, string>;
};
const outcomes = expected.packages as Record<string, Expected>;

// Immutable scenario and golden outcomes from the shared mocks. No new results are inferred.
export const grants = scenario.packages.map((pkg) => ({
  ...pkg,
  documents: pkg.documents as GrantDocument[],
  expected: outcomes[pkg.reference]!,
}));
export const grantCustomer = {
  name: "UNEC · Student grant",
  requirements: scenario.customer.requirement_sets[0]!,
};
export const grantCheckLabels: Record<string, string> = {
  "D-001": "Required document set",
  "U-01": "Required fields extracted",
  "U-02": "Recipient identity matches",
  "U-03": "Currencies match",
  "U-04": "Invoice arithmetic matches",
  "U-05": "Expenses fall within the reporting period",
  "U-06": "Expenses are within the grant limit",
  "U-07": "Invoices match statement transactions",
  "U-08": "Invoices have not been used in another report",
};
export function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "Unknown";
  if (typeof value === "object") return Object.values(value).map(displayValue).join(" · ");
  return String(value);
}
