import type { Schemas } from "@payproof/api-client";
import { checkOutcomeLabel, taskStatusLabel } from "@payproof/api-client/i18n";
import { checkOutcomeTone } from "@payproof/design-tokens";
import {
  ChevronRight,
  CircleCheck,
  FileText,
  Link2,
  ListChecks,
  PenLine,
  Pencil,
  Plus,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { CheckOutcomeBadge, StatusBadge, statusIcons } from "@/components/status/status-badges";
import { Button } from "@/components/ui/button";
import { Banner, Panel } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import { fieldForCheck } from "../correction";
import { detailText as t } from "../texts";
import { Inert } from "./package-actions";

type Pkg = Schemas["PackageDetail"];
type Check = Schemas["CheckResult"];
export type FixHint = NonNullable<Check["fix_hint"]>;

const OUTCOMES = ["PASS", "FAIL", "UNKNOWN", "NOT_APPLICABLE"] as const;
// literal class names: Tailwind only sees classes written out in the source
const ICON_COLOR = {
  PASS: "text-success",
  FAIL: "text-danger",
  UNKNOWN: "text-warning",
  NOT_APPLICABLE: "text-neutral",
} as const;
const COUNT = {
  PASS: "pass",
  FAIL: "fail",
  UNKNOWN: "unknown",
  NOT_APPLICABLE: "not_applicable",
} as const;

interface Props {
  pkg: Pkg;
  /** Fixes handled on this page; edit and upload fixes are absent when the role may not edit. */
  onFix: (fix: Fixable, check: Check) => void;
  canEdit: boolean;
  onEvidence: (evidence: Schemas["Evidence"], label: string) => void;
  /** Opens the task dialog; absent when the role may not manage tasks. */
  onTask?: (check: Check) => void;
}

export type Fixable = NonNullable<Check["fix_hint"]>;

function Fix({ check, pkg, onFix, canEdit }: { check: Check } & Omit<Props, "onEvidence">) {
  const editing = (fix: Fixable, label: string, Icon: typeof Upload, primary = false) =>
    // edit_field needs a field to open; the server may still name one the UI cannot place
    canEdit && (fix !== "edit_field" || fieldForCheck(pkg, check)) ? (
      <Button size="sm" variant={primary ? "default" : "outline"} onClick={() => onFix(fix, check)}>
        <Icon aria-hidden />
        {label}
      </Button>
    ) : (
      <Inert
        primary={primary}
        size="sm"
        icon={Icon}
        label={label}
        reason={canEdit ? "Düzəldiləcək sahə tapılmadı — yeni versiya yükləyin" : t.noEdit}
      />
    );
  switch (check.fix_hint) {
    case "link_order":
      return (
        <Button size="sm" onClick={() => onFix("link_order", check)}>
          <Link2 aria-hidden />
          Sifarişi seç
        </Button>
      );
    case "review_signature":
      return (
        <Button size="sm" onClick={() => onFix("review_signature", check)}>
          <PenLine aria-hidden />
          İmzaya bax və təsdiqlə
        </Button>
      );
    case "edit_field":
      return editing("edit_field", "Mənbəyə bax, sahəni düzəlt", Pencil, true);
    case "upload_delivery":
      return editing("upload_delivery", "Təhvil sənədi yüklə", Upload);
    case "upload_invoice":
      return editing("upload_invoice", "Yeni faktura versiyası", Upload);
    default:
      return null;
  }
}

/** The open task for this rule (one at most), or a way to create one. */
function TaskAction({ check, pkg, onTask }: { check: Check; pkg: Pkg; onTask: Props["onTask"] }) {
  const task = pkg.tasks.find((x) => x.rule_id === check.rule_id && x.status !== "RESOLVED");
  if (task)
    return (
      <Link
        href="/tasks"
        title={task.step}
        className="border-border text-text-2 hover:bg-surface-2 focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-sm border px-2 text-xs font-semibold outline-none focus-visible:ring-2 pointer-coarse:min-h-11"
      >
        <ListChecks aria-hidden className="size-3.5" />
        {`${task.number} · ${task.assignee.full_name} · ${taskStatusLabel[task.status]}`}
      </Link>
    );
  return onTask ? (
    <Button size="sm" variant="ghost" onClick={() => onTask(check)}>
      <Plus aria-hidden />
      Tapşırıq yarat
    </Button>
  ) : (
    <Inert size="sm" icon={Plus} label="Tapşırıq yarat" reason={t.noTasks} />
  );
}

function CheckCard({
  check: c,
  pkg,
  onFix,
  onEvidence,
  canEdit,
  onTask,
}: { check: Check } & Props) {
  return (
    <article
      aria-label={`${c.rule_id} ${c.title}`}
      className={cn(
        "rounded-md border p-3",
        c.outcome === "FAIL" ? "border-danger/30" : "border-warning/30",
      )}
    >
      <div className="flex items-center gap-2">
        <CheckOutcomeBadge status={c.outcome} />
        <span className="text-text-3 font-mono text-xs">{c.rule_id}</span>
      </div>
      <h4 className="mt-1.5 text-md font-bold">{c.title}</h4>
      <p className="text-text-2 text-sm">{c.message}</p>
      {c.evidence.map((e, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Mənbə: ${e.quote}`}
          onClick={() => onEvidence(e, c.title)}
          className="bg-surface-2 hover:bg-surface-3 focus-visible:ring-ring mt-2 flex w-full items-start gap-2 rounded-sm p-2 text-left text-xs outline-none focus-visible:ring-2"
        >
          <FileText aria-hidden className="text-brand mt-px size-4 shrink-0" />
          <q>{e.quote}</q>
        </button>
      ))}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Fix check={c} pkg={pkg} onFix={onFix} canEdit={canEdit} />
        <TaskAction check={c} pkg={pkg} onTask={onTask} />
      </div>
    </article>
  );
}

const Compact = ({ check: c }: { check: Check }) => {
  const Icon = statusIcons.outcome[c.outcome];
  return (
    <li className="border-border flex gap-2 border-t py-2 text-sm first:border-t-0">
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", ICON_COLOR[c.outcome])} />
      <span>
        <span className="text-text-3 font-mono text-xs">{c.rule_id}</span> {c.title}
        <span className="sr-only">{` — ${checkOutcomeLabel[c.outcome]}`}</span>
        <span className="text-text-3 block text-xs">{c.message}</span>
      </span>
    </li>
  );
};

/** Rule results of the current version (prototype `checksPanel`): problems first, never hidden. */
export function ChecksPanel({ pkg, onFix, onEvidence, canEdit, onTask }: Props) {
  const primary = pkg.checks.filter(
    (c) => (c.outcome === "FAIL" || c.outcome === "UNKNOWN") && !c.cascade,
  );
  const cascade = pkg.checks.filter((c) => c.cascade);
  const rest = pkg.checks.filter((c) => c.outcome === "PASS" || c.outcome === "NOT_APPLICABLE");
  return (
    <Panel
      title={t.checks}
      className="flex flex-col gap-3 [grid-area:checks]"
      actions={
        <span className="text-text-3 text-xs">{`qayda dəsti v${pkg.requirement_set.version} · ${pkg.checks.length} qayda`}</span>
      }
    >
      <ul aria-label="Yoxlama xülasəsi" className="flex flex-wrap gap-1.5">
        {OUTCOMES.map((o) => (
          <li key={o}>
            <StatusBadge
              tone={checkOutcomeTone[o]}
              icon={statusIcons.outcome[o]}
              label={`${pkg.summary[COUNT[o]]} ${checkOutcomeLabel[o].toLowerCase()}`}
            />
          </li>
        ))}
      </ul>
      {primary.length ? (
        <>
          <h3 id="blocking" className="text-text-3 text-xs font-bold uppercase">
            Bloklayan problemlər
          </h3>
          <ul aria-labelledby="blocking" className="flex flex-col gap-2">
            {primary.map((c) => (
              <li key={c.rule_id}>
                <CheckCard
                  check={c}
                  pkg={pkg}
                  onFix={onFix}
                  onEvidence={onEvidence}
                  canEdit={canEdit}
                  onTask={onTask}
                />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <Banner tone="success" icon={CircleCheck} title="Bloklayan problem yoxdur">
          Problem uydurulmur: bütün məcburi qaydalar cari versiyada keçib.
        </Banner>
      )}
      {cascade.length > 0 && (
        <>
          <h3 className="text-text-3 text-xs font-bold uppercase">{`Asılı yoxlamalar (${cascade.length})`}</h3>
          <p className="text-text-3 text-xs">
            Yuxarıdakı problem həll edilənə qədər aparılmır və paketi bloklayır.
          </p>
          <ul>
            {cascade.map((c) => (
              <Compact key={c.rule_id} check={c} />
            ))}
          </ul>
        </>
      )}
      <details open={!primary.length} className="group">
        <summary className="text-text-2 flex cursor-pointer list-none items-center gap-1 text-sm font-semibold">
          <ChevronRight aria-hidden className="size-4 transition-transform group-open:rotate-90" />
          {`Keçən və tətbiq olunmayan yoxlamalar (${rest.length})`}
        </summary>
        <ul className="mt-1.5">
          {rest.map((c) => (
            <Compact key={c.rule_id} check={c} />
          ))}
        </ul>
      </details>
    </Panel>
  );
}
