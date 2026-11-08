"use client";

import Link from "next/link";
import { type ReactNode, useRef } from "react";

import { t } from "@/lib/i18n";

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
          ) : (
            <h1 className="truncate text-lg font-semibold">{title}</h1>
          )}
          <div className="flex items-center justify-self-end">{trailing}</div>
        </div>
      </header>
      {large && (
        <div ref={largeRef} className="px-safe pt-1 pb-2">
          <h1 className="text-4xl leading-tight font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-text-3 text-sm">{subtitle}</p>}
        </div>
      )}
      {!large && subtitle && <p className="sr-only">{subtitle}</p>}
    </>
  );
}
