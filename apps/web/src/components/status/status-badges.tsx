import type { Schemas } from "@payproof/api-client";
import {
  checkOutcomeLabel,
  documentStatusLabel,
  packageStatusLabel,
  taskStatusLabel,
} from "@payproof/api-client/i18n";
import {
  badgeClass,
  checkOutcomeTone,
  documentStatusTone,
  packageStatusTone,
  taskStatusTone,
  type Tone,
} from "@payproof/design-tokens";
import {
  CircleCheck,
  CircleHelp,
  CircleMinus,
  CircleX,
  Clock,
  Download,
  RefreshCw,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Meta {
  tone: Tone;
  icon: LucideIcon;
  label: string;
}

/** Icon + text + colour — colour is never the only signal (prototype `.badge`). */
export function StatusBadge({ tone, icon: Icon, label, className }: Meta & { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1.5 rounded-full border border-transparent px-2.5 py-0.5 text-xs leading-[1.3] font-semibold whitespace-nowrap",
        badgeClass[tone],
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={2.4} />
      {label}
    </span>
  );
}

// Icons follow the prototype's PST / OUT / TST / DST maps.
export const statusIcons = {
  package: {
    PROCESSING: Clock,
    NEEDS_REVIEW: CircleHelp,
    NEEDS_FIX: CircleX,
    READY_FOR_APPROVAL: Clock,
    APPROVED_READY: CircleCheck,
    EXPORTED: Download,
  },
  outcome: { PASS: CircleCheck, FAIL: CircleX, UNKNOWN: CircleHelp, NOT_APPLICABLE: CircleMinus },
  task: {
    OPEN: CircleMinus,
    IN_PROGRESS: Clock,
    SUBMITTED_FOR_RECHECK: RefreshCw,
    RESOLVED: CircleCheck,
  },
  document: {
    UPLOADED: Upload,
    PROCESSING: Clock,
    EXTRACTED: CircleCheck,
    REVIEW_REQUIRED: CircleHelp,
    FAILED: CircleX,
  },
} as const satisfies {
  package: Record<Schemas["PackageStatus"], LucideIcon>;
  outcome: Record<Schemas["CheckOutcome"], LucideIcon>;
  task: Record<Schemas["TaskStatus"], LucideIcon>;
  document: Record<Schemas["DocumentVersionStatus"], LucideIcon>;
};

/** A badge for one status enum; all three maps are keyed by the same contract enum. */
function statusBadge<S extends string>(
  tone: Record<S, Tone>,
  icon: Record<S, LucideIcon>,
  label: Record<S, string>,
) {
  return function Badge({ status, className }: { status: S; className?: string }) {
    return (
      <StatusBadge
        tone={tone[status]}
        icon={icon[status]}
        label={label[status]}
        className={className}
      />
    );
  };
}

export const PackageStatusBadge = statusBadge(
  packageStatusTone,
  statusIcons.package,
  packageStatusLabel,
);
export const CheckOutcomeBadge = statusBadge(
  checkOutcomeTone,
  statusIcons.outcome,
  checkOutcomeLabel,
);
export const TaskStatusBadge = statusBadge(taskStatusTone, statusIcons.task, taskStatusLabel);
export const DocumentStatusBadge = statusBadge(
  documentStatusTone,
  statusIcons.document,
  documentStatusLabel,
);
