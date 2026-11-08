import type { PackageStatus } from "@/lib/i18n";

// The prototype's mobile chips (M_CHIPS): one URL value each, mapped to API statuses.
const FILTERS = {
  all: undefined,
  ready: ["READY_FOR_APPROVAL"],
  problem: ["NEEDS_FIX", "NEEDS_REVIEW"],
  approved: ["APPROVED_READY"],
  exported: ["EXPORTED"],
} as const satisfies Record<string, readonly PackageStatus[] | undefined>;

export type PackageFilter = keyof typeof FILTERS;
export const packageFilters = Object.keys(FILTERS) as PackageFilter[];

export const parseFilter = (raw: string | null): PackageFilter =>
  raw !== null && Object.hasOwn(FILTERS, raw) ? (raw as PackageFilter) : "all";

export const filterStatuses = (f: PackageFilter): PackageStatus[] | undefined => {
  const statuses = FILTERS[f];
  return statuses && [...statuses];
};

export function filterCount(f: PackageFilter, counts: Record<PackageStatus, number>): number {
  const statuses: readonly PackageStatus[] = FILTERS[f] ?? (Object.keys(counts) as PackageStatus[]);
  return statuses.reduce((sum, s) => sum + counts[s], 0);
}

/** The package list URL; filter and search live in the URL so back, reload and sharing keep them. */
export function packagesHref(f: PackageFilter, q = ""): string {
  const params = new URLSearchParams();
  if (f !== "all") params.set("status", f);
  if (q.trim()) params.set("q", q.trim());
  const query = params.toString();
  return query ? `/packages?${query}` : "/packages";
}
