import type { Schemas } from "@payproof/api-client";

type Item = Schemas["PackageListItem"];
type Status = Schemas["PackageStatus"];
type Key = (string | number | bigint)[];

const STATUSES: Status[] = [
  "PROCESSING",
  "NEEDS_REVIEW",
  "NEEDS_FIX",
  "READY_FOR_APPROVAL",
  "APPROVED_READY",
  "EXPORTED",
];
const DEFAULT_SORT = "-updated_at";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const cents = (m: Schemas["Money"]) => BigInt(m.amount.replace(".", ""));

// Sort keys of the contract. Totals compare within a currency only — never across AZN/USD.
const SORT_KEYS: Record<string, (p: Item) => Key | null> = {
  invoice_number: (p) => (p.invoice_number === null ? null : [p.invoice_number]),
  customer: (p) => [p.customer.name],
  invoice_date: (p) => (p.invoice_date === null ? null : [p.invoice_date]),
  total: (p) => p.total && [p.total.currency, cents(p.total)],
  status: (p) => [STATUSES.indexOf(p.status)],
  blocking: (p) => [p.blocking.length],
  owner: (p) => [p.owner.full_name],
  updated_at: (p) => [p.updated_at],
  problem_age: (p) => (p.problem_since === null ? null : [-Date.parse(p.problem_since)]),
};

function compareKeys(a: Key, b: Key): number {
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? "";
    const y = b[i] ?? "";
    const c =
      typeof x === "string" && typeof y === "string"
        ? x.localeCompare(y, "az")
        : x < y
          ? -1
          : x > y
            ? 1
            : 0;
    if (c !== 0) return c;
  }
  return 0;
}

// Missing values (still processing) always go last; ties fall back to the id for a stable order.
function sortItems(items: Item[], sort: string): Item[] {
  const desc = sort.startsWith("-");
  const key = SORT_KEYS[sort.replace(/^-/, "")];
  if (!key) throw new QueryError("sort");
  return [...items].sort((p, q) => {
    const a = key(p);
    const b = key(q);
    if (a === null || b === null) return a === b ? p.id.localeCompare(q.id) : a === null ? 1 : -1;
    return (desc ? -1 : 1) * compareKeys(a, b) || p.id.localeCompare(q.id);
  });
}

export class QueryError extends Error {
  constructor(readonly param: string) {
    super(`Invalid query parameter: ${param}`);
  }
}

const encodeCursor = (offset: number) => btoa(JSON.stringify({ o: offset }));
function decodeCursor(cursor: string): number {
  try {
    const { o } = JSON.parse(atob(cursor)) as { o: unknown };
    if (typeof o === "number" && Number.isInteger(o) && o >= 0) return o;
  } catch {
    // falls through to the validation error below
  }
  throw new QueryError("cursor");
}

function parseLimit(raw: string | null): number {
  if (raw === null) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) throw new QueryError("limit");
  return n;
}

// Case-insensitive search key. The az locale lowercases "I" to "ı", so "inv" would not find
// "INV-1038": fold I/İ/ı to plain "i" on both sides instead.
const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\u0307/g, "")
    .replace(/ı/g, "i");

// shortcut: these contract filters arrive with S-06; until then the mock refuses them loudly
// instead of returning an unfiltered list.
const UNSUPPORTED = ["customer_id", "owner_id", "issue", "from", "to"];

/** GET /v1/packages over the given items; throws QueryError for an invalid parameter. */
export function listPackages(
  all: readonly Item[],
  params: URLSearchParams,
): Schemas["PackagePage"] {
  const unsupported = UNSUPPORTED.find((name) => params.has(name));
  if (unsupported) throw new QueryError(unsupported);
  const statuses = params.get("status")?.split(",").filter(Boolean) ?? [];
  if (statuses.some((s) => !(STATUSES as string[]).includes(s))) throw new QueryError("status");
  const q = fold(params.get("q")?.trim() ?? "");
  const matches = (p: Item) =>
    [p.invoice_number, p.customer.name, p.po_ref].some((v) => v !== null && fold(v).includes(q));
  const filtered = all.filter(
    (p) => (statuses.length === 0 || statuses.includes(p.status)) && (!q || matches(p)),
  );
  const sorted = sortItems(filtered, params.get("sort") ?? DEFAULT_SORT);
  const limit = parseLimit(params.get("limit"));
  const cursor = params.get("cursor");
  const offset = cursor ? decodeCursor(cursor) : 0;
  const end = offset + limit;
  return {
    items: sorted.slice(offset, end),
    next_cursor: end < sorted.length ? encodeCursor(end) : null,
    total_count: sorted.length,
  };
}
