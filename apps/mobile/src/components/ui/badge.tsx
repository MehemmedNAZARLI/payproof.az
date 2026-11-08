import {
  badgeClass,
  checkOutcomeTone,
  packageStatusTone,
  taskStatusTone,
  type Tone,
} from "@payproof/design-tokens";
import type { ReactNode } from "react";

import { cx } from "@/lib/cx";
import { type CheckOutcome, type PackageStatus, t, type TaskStatus } from "@/lib/i18n";

import { Icon, type IconName } from "./icon";

type BadgeProps = { tone: Tone; icon?: IconName; children: ReactNode; className?: string };

export function Badge({ tone, icon, children, className }: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-semibold whitespace-nowrap",
        badgeClass[tone],
        className,
      )}
    >
      {icon && <Icon name={icon} size={14} strokeWidth={2} />}
      {children}
    </span>
  );
}

// Icons as in the prototype's PST / OUT / TST maps, so status never relies on colour alone.
const packageIcon: Record<PackageStatus, IconName> = {
  PROCESSING: "clock",
  NEEDS_REVIEW: "unknown",
  NEEDS_FIX: "fail",
  READY_FOR_APPROVAL: "clock",
  APPROVED_READY: "pass",
  EXPORTED: "download",
};
const outcomeIcon: Record<CheckOutcome, IconName> = {
  PASS: "pass",
  FAIL: "fail",
  UNKNOWN: "unknown",
  NOT_APPLICABLE: "na",
};
const taskIcon: Record<TaskStatus, IconName> = {
  OPEN: "na",
  IN_PROGRESS: "clock",
  SUBMITTED_FOR_RECHECK: "refresh",
  RESOLVED: "pass",
};

export function PackageStatusBadge({ status }: { status: PackageStatus }) {
  return (
    <Badge tone={packageStatusTone[status]} icon={packageIcon[status]}>
      {t.package.status[status]}
    </Badge>
  );
}

export function CheckOutcomeBadge({ outcome }: { outcome: CheckOutcome }) {
  return (
    <Badge tone={checkOutcomeTone[outcome]} icon={outcomeIcon[outcome]}>
      {t.check.outcome[outcome]}
    </Badge>
  );
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge tone={taskStatusTone[status]} icon={taskIcon[status]}>
      {t.task.status[status]}
    </Badge>
  );
}
