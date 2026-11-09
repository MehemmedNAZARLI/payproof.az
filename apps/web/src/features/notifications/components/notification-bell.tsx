"use client";

import { formatDateTime } from "@payproof/api-client/format";
import { shellText } from "@payproof/api-client/i18n";
import { Bell, BellOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { Popover } from "radix-ui";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useMarkAllRead, useMarkRead, useNotifications } from "../queries";

/** Topbar bell (prototype `notifPop`): unread count, newest first, click → package. */
export function NotificationBell({ className }: { className: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const list = useNotifications();
  const read = useMarkRead();
  const readAll = useMarkAllRead();
  const unread = list.data?.unread_count ?? 0;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={`${shellText.notifications}, ${unread} oxunmamış`}
        className={cn(className, "relative")}
      >
        <Bell aria-hidden className="size-5" />
        {unread > 0 && (
          <span
            aria-hidden
            className="bg-danger absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full px-1 text-[10px] leading-4 font-bold text-white"
          >
            {unread}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          aria-label={shellText.notifications}
          className="bg-surface border-border shadow-3 z-50 flex max-h-[min(480px,calc(100dvh-80px))] w-[min(380px,calc(100vw-32px))] flex-col rounded-lg border"
        >
          <div className="border-border flex items-center justify-between gap-2 border-b px-4 py-3">
            <h2 className="font-bold">{shellText.notifications}</h2>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => readAll.mutate()}
                className="text-brand focus-visible:ring-ring rounded-sm text-sm font-semibold outline-none hover:underline focus-visible:ring-2"
              >
                Hamısını oxunmuş et
              </button>
            )}
          </div>
          {list.data?.items.length === 0 && (
            <p className="text-text-2 flex flex-col items-center gap-1 p-6 text-center text-sm">
              <BellOff aria-hidden className="text-text-3 size-6" />
              <b>Bildiriş yoxdur</b>
              Yeni hadisə olduqda burada görünəcək.
            </p>
          )}
          <ul className="overflow-auto">
            {list.data?.items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!n.read_at) read.mutate(n.id);
                    setOpen(false);
                    if (n.package) router.push(`/packages/${n.package.id}`);
                  }}
                  className={cn(
                    "hover:bg-surface-2 focus-visible:bg-surface-2 border-border flex w-full gap-2 border-b px-4 py-3 text-left text-sm outline-none last:border-b-0",
                    !n.read_at && "bg-brand-50/60",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      n.read_at ? "bg-border" : "bg-brand",
                    )}
                  />
                  <span>
                    {!n.read_at && <span className="sr-only">Oxunmamış: </span>}
                    {n.text}
                    <span className="text-text-3 block text-xs">
                      {formatDateTime(n.created_at)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
