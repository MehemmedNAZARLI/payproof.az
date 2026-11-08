"use client";

import Link from "next/link";
import { createContext, type ReactNode, useContext } from "react";

import { cx } from "@/lib/cx";

import { Icon } from "./icon";

type Variant = "inset" | "cards";
const VariantContext = createContext<Variant>("inset");

type ListGroupProps = {
  variant?: Variant;
  label?: string;
  children: ReactNode;
  className?: string;
};

// "inset": iOS grouped list — one card, rows split by inset hairlines. "cards": a stack of cards.
export function ListGroup({ variant = "inset", label, children, className }: ListGroupProps) {
  return (
    <VariantContext.Provider value={variant}>
      <ul
        aria-label={label}
        className={cx(
          variant === "inset"
            ? "bg-surface overflow-hidden rounded-lg shadow-1"
            : "flex flex-col gap-2",
          className,
        )}
      >
        {children}
      </ul>
    </VariantContext.Provider>
  );
}

type ListItemProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Extra row under the subtitle (badges). */
  meta?: ReactNode;
  href?: string;
  onClick?: () => void;
  /** Defaults to true for links and buttons. */
  chevron?: boolean;
};

export function ListItem(props: ListItemProps) {
  const { href, onClick, leading } = props;
  const variant = useContext(VariantContext);
  const interactive = href !== undefined || onClick !== undefined;
  const row = cx(
    "flex w-full min-h-14 items-center gap-3 px-4 py-3 text-left focus-visible:outline-offset-[-2px]",
    interactive &&
      "transition-[background-color,transform] duration-base ease-base active:bg-surface-2",
    variant === "cards" && "rounded-lg",
    variant === "cards" && interactive && "active:scale-[0.985]",
  );
  const content = <RowContent {...props} chevron={props.chevron ?? interactive} />;
  return (
    <li
      className={cx(
        "relative",
        variant === "cards" && "bg-surface rounded-lg shadow-1",
        variant === "inset" &&
          "not-first:before:absolute not-first:before:top-0 not-first:before:right-0 not-first:before:h-[0.5px] not-first:before:bg-[var(--hairline)]",
        variant === "inset" && (leading ? "not-first:before:left-15" : "not-first:before:left-4"),
      )}
    >
      {href !== undefined ? (
        <Link href={href} className={row}>
          {content}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={row}>
          {content}
        </button>
      ) : (
        <div className={row}>{content}</div>
      )}
    </li>
  );
}

function RowContent({ title, subtitle, leading, trailing, meta, chevron }: ListItemProps) {
  return (
    <>
      {leading && <span className="text-text-2 flex size-8 shrink-0 items-center">{leading}</span>}
      <span className="min-w-0 grow">
        <span className="block truncate text-md font-semibold">{title}</span>
        {subtitle && <span className="text-text-3 block truncate text-sm">{subtitle}</span>}
        {meta && <span className="mt-1.5 flex flex-wrap items-center gap-1.5">{meta}</span>}
      </span>
      {trailing && <span className="shrink-0 text-right">{trailing}</span>}
      {chevron && (
        <Icon name="chev-r" size={18} strokeWidth={2.2} className="text-text-3 -mr-1 shrink-0" />
      )}
    </>
  );
}
