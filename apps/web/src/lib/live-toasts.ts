"use client";

import type { Schemas } from "@payproof/api-client";
import { ui } from "@payproof/api-client/i18n";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { useMe } from "@/features/auth";
import { packageKeys } from "@/features/packages";
import { useUsers } from "@/features/users";
import { onLiveEvent } from "./live";

type LiveEvent = Schemas["LiveEvent"];

// shortcut: texts live here until the shared i18n package gets live-update keys
const VERB: Partial<Record<LiveEvent["type"], string>> = {
  "package.created": "yaratdı",
  "package.updated": "yenilədi",
  "package.approved": "təsdiqlədi",
  "package.exported": "ixrac etdi",
  "package.deleted": "sildi",
};

/** "Aygün Məmmədova INV-1042 paketini yenilədi (v5)"; null when the event gets no toast. */
export function liveToastText(
  event: LiveEvent,
  { actor, invoice }: { actor: string | null; invoice?: string },
) {
  const who = actor ?? ui.system;
  const verb = VERB[event.type];
  if (verb) {
    const version = event.package_version ? ` (v${event.package_version})` : "";
    return `${who} ${invoice ? `${invoice} paketini` : "paketi"} ${verb}${version}`;
  }
  if (event.type === "task.changed")
    return `${who} ${invoice ? `${invoice} paketinin tapşırığını` : "tapşırığı"} yenilədi`;
  if (event.type === "requirements.changed") return `${who} müştəri qaydasını yenilədi`;
  return null; // notifications have their own UI (W-16); unknown types only refetch
}

/**
 * The invoice number from whatever package list or detail is cached; events carry IDs only.
 * Knows the two package cache shapes in use: a page (`{ items }`) and a detail (the package itself).
 * An infinite query (`{ pages }`) would need a branch here; without a hit the toast says "paketi".
 */
function cachedInvoice(client: QueryClient, packageId: string): string | undefined {
  for (const [, data] of client.getQueriesData<unknown>({ queryKey: packageKeys.all })) {
    const items = (data as { items?: { id: string; invoice_number: string | null }[] })?.items ?? [
      data,
    ];
    const hit = items.find((p) => (p as { id?: string })?.id === packageId) as
      { invoice_number?: string | null } | undefined;
    if (hit?.invoice_number) return hit.invoice_number;
  }
}

/** "Who changed what" toasts for other people's changes; one toast per package (merged). */
export function useLiveToasts() {
  const client = useQueryClient();
  const me = useMe().data;
  const users = useUsers().data;
  useEffect(
    () =>
      onLiveEvent((event) => {
        if (!me || event.actor_id === me.id) return; // own changes: refetch only, no toast
        const actor = event.actor_id
          ? (users?.find((u) => u.id === event.actor_id)?.full_name ?? "Başqa istifadəçi")
          : null;
        const invoice = event.package_id ? cachedInvoice(client, event.package_id) : undefined;
        const text = liveToastText(event, { actor, invoice });
        if (text) toast.info(text, { id: `live:${event.package_id ?? event.type}` });
      }),
    [client, me, users],
  );
}
