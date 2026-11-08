import type { ComponentPropsWithoutRef } from "react";

import { cx } from "@/lib/cx";

type ChipProps = Omit<ComponentPropsWithoutRef<"button">, "aria-pressed"> & {
  pressed: boolean;
  count?: number;
};

// Filter toggle. 36px pill, but the ::before extends the hit area to 44px (touch-target rule).
export function Chip({ pressed, count, children, className, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cx(
        "relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold",
        "transition-[background-color,color,transform] duration-base ease-base active:scale-[0.96]",
        "before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
        pressed ? "bg-text text-bg" : "bg-surface text-text-2 shadow-1",
        className,
      )}
      {...rest}
    >
      {children}
      {count !== undefined && " "}
      {count !== undefined && <span className="text-xs tabular-nums opacity-70">{count}</span>}
    </button>
  );
}
