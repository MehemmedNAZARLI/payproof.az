import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import type { Schemas } from "@/lib/api";
import { cx } from "@/lib/cx";
import { notificationText } from "@/lib/english";
import { formatTime } from "@/lib/format";
import { t } from "@/lib/i18n";

type Props = { notification: Schemas["Notification"]; onOpen: () => void };

// One notification. Unread: a dot and bold text (and "Unread" for screen readers).
// With a package it opens it; the tap also marks it read.
export function NotificationRow({ notification: n, onOpen }: Props) {
  const unread = n.read_at === null;
  const body = (
    <>
      <span className="relative mt-0.5 shrink-0">
        <span
          aria-hidden="true"
          className={cx(
            "absolute top-1/2 -left-3 size-2.5 -translate-y-1/2 rounded-full transition-opacity",
            unread ? "bg-accent opacity-100" : "opacity-0",
          )}
        />
        <span
          className={cx(
            "grid size-9 place-items-center rounded-full",
            unread ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-3",
          )}
        >
          <Icon name={n.package ? "package" : "bell"} size={20} />
        </span>
      </span>
      <span className="min-w-0 grow">
        {unread && <span className="sr-only">{t.notifications.unread}: </span>}
        <span
          className={cx(
            "block text-subhead leading-snug text-pretty",
            unread ? "font-semibold" : "text-text-2",
          )}
        >
          {notificationText(n.text)}
        </span>
        <span className="text-text-3 mt-0.5 block text-footnote tabular-nums">
          {[n.package?.invoice_number, formatTime(n.created_at)].filter(Boolean).join(" · ")}
        </span>
      </span>
      {n.package && (
        <Icon
          name="chev-r"
          size={18}
          strokeWidth={2.2}
          className="text-text-3 mt-2 -mr-1 shrink-0"
        />
      )}
    </>
  );
  const row =
    "flex w-full items-start gap-3 py-3 pr-4 pl-6 text-left transition-colors duration-base active:bg-surface-2 focus-visible:outline-offset-[-2px]";
  return (
    <li className="relative not-first:before:absolute not-first:before:top-0 not-first:before:right-0 not-first:before:left-18 not-first:before:h-[0.5px] not-first:before:bg-[var(--hairline)]">
      {n.package ? (
        <Link href={`/packages/${n.package.id}`} onClick={onOpen} className={row}>
          {body}
        </Link>
      ) : (
        <button type="button" onClick={onOpen} className={row}>
          {body}
        </button>
      )}
    </li>
  );
}
