import { unwrap, type Schemas } from "@payproof/api-client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { packageKeys } from "@/features/packages/queries";
import { api } from "@/lib/api";

export interface AuditFilter {
  q: string;
  /** A user id, "system" (events without an actor), or "" for everyone. */
  actor: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** URL → filter; a hand-edited actor that is neither a user id nor "system" is dropped. */
export function auditFilter(q: URLSearchParams): AuditFilter {
  const actor = q.get("actor") ?? "";
  return { q: q.get("q") ?? "", actor: actor === "system" || UUID.test(actor) ? actor : "" };
}

const query = ({ q, actor }: AuditFilter) => ({
  q: q || undefined,
  actor_id: actor || undefined,
});

// under packageKeys.all: package and rule events already invalidate it (lib/live.ts)
export const auditKeys = {
  list: (f: AuditFilter) => [...packageKeys.all, "audit-log", f] as const,
};

// shortcut: the newest 100 events; a "load more" can follow next_cursor when logs grow
export const useAudit = (f: AuditFilter) =>
  useQuery({
    queryKey: auditKeys.list(f),
    // the operation also serves CSV, so its success type is a union: this call is the JSON one
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/v1/audit", { params: { query: { ...query(f), limit: 100 } }, signal }),
      ) as Promise<Schemas["AuditPage"]>,
    placeholderData: keepPreviousData,
  });

/** The full filtered log as CSV (server-built: same columns as the contract). */
export const auditCsv = (f: AuditFilter) =>
  unwrap(
    api.GET("/v1/audit", {
      params: { query: { ...query(f), format: "csv" } },
      parseAs: "text",
    }),
  ) as Promise<string>;
