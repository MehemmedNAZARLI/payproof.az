"use client";

import Link from "next/link";
import { type ReactNode, useRef } from "react";

import { t } from "@/lib/i18n";
import { useOnline } from "@/lib/online";

import { Icon } from "./icon";
import { useScrollCollapse } from "./use-scroll-collapse";

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  /** Tab roots: a 34px title that collapses into the bar on scroll (iOS large title). */
  large?: boolean;
  back?: { href: string; label?: string };
  trailing?: ReactNode;
};

export function AppHeader({ title, subtitle, large = false, back, trailing }: AppHeaderProps) {
  const barRef = useRef<HTMLElement>(null);
  const largeRef = useRef<HTMLDivElement>(null);
  useScrollCollapse(barRef, largeRef);

  return (
    <>
      <header ref={barRef} className="pt-safe sticky top-0 z-30 [--p:0]">
        {/* Bar material fades in as content slides under it (scroll-edge appearance). */}
        <div aria-hidden="true" className="material hairline-b absolute inset-0 opacity-(--p)" />
        <div className="relative grid h-(--navbar-h) grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-2 px-2">
          <div className="justify-self-start">
            {back && (
              <Link
                href={back.href}
                className="text-brand-600 -ml-1 flex min-h-11 items-center pr-2 text-lg active:opacity-50"
              >
                <Icon name="chev-l" size={28} strokeWidth={2.2} />
                <span className="-ml-0.5">{back.label ?? t.nav.back}</span>
              </Link>
            )}
          </div>
          {large ? (
            <span
              aria-hidden="true"
              className="truncate text-lg font-semibold"
              style={{ opacity: "clamp(0, calc((var(--p) - 0.7) * 3.4), 1)" }}
            >
              {title}
            </span>
          ) : subtitle ? (
            // Detail screens: a compact two-line title (number over customer), as in UINavigationBar.
            <div className="min-w-0 text-center leading-tight">
              <h1 className="truncate text-md font-semibold">{title}</h1>
              <p className="text-text-3 truncate text-xs">{subtitle}</p>
            </div>
          ) : (
            <h1 className="truncate text-lg font-semibold">{title}</h1>
          )}
          <div className="flex items-center justify-self-end">{trailing}</div>
        </div>
        <OfflineStrip />
      </header>
      {large && (
        <div ref={largeRef} className="px-safe pull-shift pt-1 pb-2">
          <h1 className="text-4xl leading-tight font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-text-3 text-sm">{subtitle}</p>}
        </div>
      )}
    </>
  );
}

// Under every bar while offline: what is on screen is the last loaded data. The status region is
// always there, so screen readers announce the change when the connection drops.
function OfflineStrip() {
  const online = useOnline();
  return (
    <div role="status" className="relative">
      {!online && (
        <p className="bg-warning-bg text-warning flex h-7 animate-[fade-in_200ms_var(--ease)] items-center justify-center gap-1.5 px-4 text-xs font-semibold">
          <Icon name="wifi-off" size={14} strokeWidth={2.2} />
          {t.offline.strip}
        </p>
      )}
    </div>
  );
}
