import type { ComponentPropsWithoutRef } from "react";

import { cx } from "@/lib/cx";

import { Icon, type IconName } from "./icon";

const MAX_COUNT = 99;

// Red capsule with an unread count. Decorative: the owner puts the count in its accessible name.
export function CountBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "bg-danger text-danger-foreground ring-surface h-4.5 min-w-4.5 rounded-full px-1 text-center text-[11px] leading-4.5 font-bold tabular-nums ring-2",
        className,
      )}
    >
      {count > MAX_COUNT ? `${MAX_COUNT}+` : count}
    </span>
  );
}

type IconButtonProps = Omit<ComponentPropsWithoutRef<"button">, "aria-label" | "children"> & {
  icon: IconName;
  label: string;
  count?: number;
};

// 44×44 round icon button for bars and sheets; `label` is required for VoiceOver/TalkBack.
export function IconButton({ icon, label, count = 0, className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cx(
        "text-brand-600 relative grid size-11 place-items-center rounded-full transition-opacity active:opacity-50",
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={24} />
      {count > 0 && <CountBadge count={count} className="absolute top-1 right-0.5" />}
    </button>
  );
}
