import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

import { Icon, type IconName } from "./icon";

export type BannerTone = "danger" | "warning" | "success" | "info" | "accent" | "neutral";

const toneClass: Record<BannerTone, string> = {
  danger: "bg-danger-soft [--tone:var(--danger)]",
  warning: "bg-warning-soft [--tone:var(--warning)]",
  success: "bg-success-soft [--tone:var(--success)]",
  info: "bg-surface [--tone:var(--accent)] shadow-1",
  accent: "bg-accent-soft [--tone:var(--accent)]",
  neutral: "bg-surface-2 [--tone:var(--text-2)]",
};

const toneIcon: Record<BannerTone, IconName> = {
  danger: "fail",
  warning: "alert",
  success: "pass",
  info: "info",
  accent: "info",
  neutral: "info",
};

type BannerProps = {
  tone: BannerTone;
  title: string;
  children?: ReactNode;
  icon?: IconName;
  action?: ReactNode;
  className?: string;
};

// Meaning is carried by icon + title text, never by colour alone.
export function Banner({ tone, title, children, icon, action, className }: BannerProps) {
  return (
    <div className={cx("flex items-start gap-3 rounded-lg p-4", toneClass[tone], className)}>
      <Icon name={icon ?? toneIcon[tone]} size={22} className="mt-px shrink-0 text-[var(--tone)]" />
      <div className="min-w-0 grow">
        <h3 className="text-subhead font-semibold text-text">{title}</h3>
        {children && (
          <div className="text-text-2 mt-0.5 text-footnote leading-snug">{children}</div>
        )}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}
