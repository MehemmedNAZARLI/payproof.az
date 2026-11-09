import type { paths, Schemas } from "@payproof/api-client";
import type { Sort } from "@/components/ui/data-table";

export type ListParams = NonNullable<paths["/v1/packages"]["get"]["parameters"]["query"]>;
type SortValue = NonNullable<ListParams["sort"]>;

// Runtime copies of the contract enums: a shared or hand-edited URL is untrusted input.
const STATUSES = [
  "PROCESSING",
  "NEEDS_REVIEW",
  "NEEDS_FIX",
  "READY_FOR_APPROVAL",
  "APPROVED_READY",
  "EXPORTED",
] as const satisfies readonly Schemas["PackageStatus"][];
export const SORT_KEYS = [
  "invoice_number",
  "customer",
  "invoice_date",
  "total",
  "status",
  "blocking",
  "owner",
  "updated_at",
  "problem_age",
] as const;
export const DEFAULT_SORT: SortValue = "-updated_at";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const RULE = /^R-0(0[1-9]|10)$/;

// A real calendar date (rejects 2026-13-45 and 2026-02-30, which Date would roll over).
const isDate = (v: string) => {
  const t = Date.parse(`${v}T00:00:00Z`);
  return DATE.test(v) && !Number.isNaN(t) && new Date(t).toISOString().startsWith(v);
};
const isSort = (v: string): v is SortValue =>
  (SORT_KEYS as readonly string[]).includes(v.replace(/^-/, ""));
const isStatus = (v: string): v is Schemas["PackageStatus"] =>
  (STATUSES as readonly string[]).includes(v);

/** URL search params → API query, keeping only values the API accepts. */
export function listParams(sp: URLSearchParams): ListParams {
  const get = (key: string, ok: (v: string) => boolean) => {
    const v = sp.get(key)?.trim();
    return v && ok(v) ? v : undefined;
  };
  const status = [...new Set((sp.get("status") ?? "").split(",").filter(isStatus))];
  const from = get("from", isDate);
  const to = get("to", (v) => isDate(v) && (!from || v >= from));
  const params: ListParams = {
    q: get("q", (v) => v.length <= 100),
    status: status.length ? status : undefined,
    customer_id: get("customer_id", (v) => UUID.test(v)),
    issue: get("issue", (v) => RULE.test(v)),
    owner_id: get("owner_id", (v) => UUID.test(v)),
    from,
    to,
    sort: get("sort", isSort) as SortValue | undefined,
    cursor: get("cursor", () => true),
  };
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined),
  ) as ListParams;
}

const ORDER = [
  "q",
  "status",
  "customer_id",
  "issue",
  "owner_id",
  "from",
  "to",
  "sort",
  "cursor",
] as const;

/** API query → canonical URL search (`?…` or ""), without the default sort. */
export function listSearch(params: ListParams): string {
  const sp = new URLSearchParams();
  for (const key of ORDER) {
    const v = params[key];
    if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) continue;
    if (key === "sort" && v === DEFAULT_SORT) continue;
    sp.set(key, Array.isArray(v) ? v.join(",") : String(v));
  }
  const s = sp.toString().replaceAll("%2C", ",");
  return s ? `?${s}` : "";
}

export const sortFromParam = (sort: SortValue | undefined): Sort => {
  const v = sort ?? DEFAULT_SORT;
  return { id: v.replace(/^-/, ""), desc: v.startsWith("-") };
};

export const sortParam = ({ id, desc }: Sort) => `${desc ? "-" : ""}${id}` as SortValue;
