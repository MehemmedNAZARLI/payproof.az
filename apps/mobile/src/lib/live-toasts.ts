"use client";

import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { toast } from "@/components/ui/toast-store";
import { packageKeys } from "@/features/packages/queries";

import { api, unwrap } from "./api";
import { t } from "./i18n";
import { type LiveEvent, onLiveEvent } from "./live";
import { useSession } from "./session";

/** "Aygün Məmmədova INV-1042 package updated (v5)"; null when the event gets no toast. */
export function liveToastText(
  event: LiveEvent,
  { actor, invoice }: { actor: string | null; invoice?: string },
): string | null {
  const who = actor ?? t.live.system;
  const verb = t.live.verb[event.type];
  if (verb) {
    const version = event.package_version ? ` (v${event.package_version})` : "";
    return `${who} ${verb} ${t.live.pkg(invoice)}${version}`;
  }
  if (event.type === "task.changed") return `${who} ${t.live.updated} ${t.live.task(invoice)}`;
  if (event.type === "requirements.changed") return `${who} ${t.live.updated} ${t.live.rules}`;
  return null; // notifications have their own badge; unknown types only refetch
}

/** The invoice number from a cached package list or detail; events carry IDs only. */
export function cachedInvoice(client: QueryClient, packageId: string): string | undefined {
  for (const [, data] of client.getQueriesData<unknown>({ queryKey: packageKeys.all })) {
    const items = (data as { items?: unknown[] } | undefined)?.items ?? [data];
    for (const p of items as ({ id?: string; invoice_number?: string | null } | undefined)[])
      if (p?.id === packageId && p.invoice_number) return p.invoice_number;
  }
}

const usersKey = ["users"] as const;

/** "Who changed what" toasts for other people's changes; own changes only refetch. */
export function useLiveToasts() {
  const client = useQueryClient();
  const me = useSession()?.user.id;
  useEffect(
    () =>
      onLiveEvent((event) => {
        if (!me || event.actor_id === me || !liveToastText(event, { actor: null })) return;
        const invoice = event.package_id ? cachedInvoice(client, event.package_id) : undefined;
        // Names come from GET /v1/users, fetched once on the first such event.
        const names = event.actor_id
          ? client
              .fetchQuery({
                queryKey: usersKey,
                queryFn: ({ signal }) => unwrap(api.GET("/v1/users", { signal })),
                staleTime: 10 * 60_000,
              })
              .then(
                ({ items }) =>
                  items.find((u) => u.id === event.actor_id)?.full_name ?? t.live.someone,
                () => t.live.someone,
              )
          : Promise.resolve(null);
        void names.then((actor) => {
          const text = liveToastText(event, { actor, invoice });
          if (text) toast.info(text);
        });
      }),
    [client, me],
  );
}
