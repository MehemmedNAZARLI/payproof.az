"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cx } from "@/lib/cx";
import { t } from "@/lib/i18n";

import { Icon, type IconName } from "./icon";
import { CountBadge } from "./icon-button";

const tabs: { href: string; icon: IconName; label: string; counted?: boolean }[] = [
  { href: "/home", icon: "home", label: t.nav.home },
  { href: "/packages", icon: "package", label: t.nav.packages },
  { href: "/notifications", icon: "bell", label: t.nav.notifications, counted: true },
  { href: "/profile", icon: "user", label: t.nav.profile },
];

const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

// Translucent bottom bar over the content; pages reserve room for it with `pb-tabbar`.
export function TabBar({ notificationCount = 0 }: { notificationCount?: number }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={t.nav.label}
      className="material hairline-t pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-app"
    >
      <ul className="flex h-(--tabbar-h) px-safe">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href);
          const count = tab.counted ? notificationCount : 0;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                aria-label={count > 0 ? t.common.notificationsUnread(count) : undefined}
                className={cx(
                  "flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors active:opacity-60",
                  active ? "text-accent" : "text-text-3",
                )}
              >
                <span className="relative">
                  <Icon name={tab.icon} size={26} strokeWidth={active ? 2.2 : 1.7} />
                  {count > 0 && (
                    <CountBadge count={count} className="absolute -top-1 left-[calc(100%-10px)]" />
                  )}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
