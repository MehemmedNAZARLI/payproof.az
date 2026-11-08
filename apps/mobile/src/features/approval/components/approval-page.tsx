"use client";

import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Icon } from "@/components/ui/icon";
import { ListGroup, ListItem } from "@/components/ui/list";
import { docIcon } from "@/features/package-detail/components/documents-list";
import type { Schemas } from "@/lib/api";
import { cx } from "@/lib/cx";
import { t } from "@/lib/i18n";

import type { ApprovalFlow } from "../use-approval-flow";
import { FailureBanner } from "./failure-banner";

type Detail = Schemas["PackageDetail"];

function Facts({ pkg }: { pkg: Detail }) {
  const s = pkg.summary;
  const rows: [string, string][] = [
    [t.approval.currentVersion, `v${pkg.version}`],
    [t.approval.ruleSet, `v${pkg.requirement_set.version}`],
    [t.approval.checks, t.approval.checksValue(s.pass, s.not_applicable, s.blocking.length)],
  ];
  return (
    <dl className="bg-surface-2 rounded-lg px-4 py-1">
      {rows.map(([k, v]) => (
        <div
          key={k}
          className="hairline-b flex justify-between gap-3 py-2.5 text-footnote last:shadow-none"
        >
          <dt className="text-text-3">{k}</dt>
          <dd className="text-right font-semibold tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// Re-keyed on every nudge, so tapping a locked "Təsdiqlə" again replays the shake.
const nudged = (flow: ApprovalFlow, step: "docs" | "ack") =>
  flow.nudge?.step === step ? `${step}-${flow.nudge.n}` : step;

function StepTitle({ children, aside }: { children: string; aside?: string }) {
  return (
    <div className="mt-5 mb-2 flex items-baseline justify-between px-1">
      <h3 className="text-subhead font-bold">{children}</h3>
      {aside && <span className="text-text-3 text-footnote tabular-nums">{aside}</span>}
    </div>
  );
}

type Props = {
  pkg: Detail;
  flow: ApprovalFlow;
  onOpenDocument: (doc: Schemas["Document"]) => void;
};

export function ApprovalPage({ pkg, flow, onOpenDocument }: Props) {
  const total = flow.docs.length;
  const seen = total - flow.unseen;
  const shake = { animation: "nudge 420ms ease-in-out" };
  return (
    <>
      <Facts pkg={pkg} />
      <FailureBanner flow={flow} />

      <section key={nudged(flow, "docs")} style={flow.nudge?.step === "docs" ? shake : undefined}>
        <StepTitle aside={t.approval.seenProgress(seen, total)}>{t.approval.stepDocs}</StepTitle>
        <div
          role="progressbar"
          aria-label={t.approval.stepDocs}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={seen}
          className="bg-surface-3 mb-2 h-1 overflow-hidden rounded-full"
        >
          <div
            className="bg-success h-full rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${total ? (seen / total) * 100 : 0}%` }}
          />
        </div>
        <ListGroup label={t.approval.stepDocs} className="bg-surface-2 shadow-none">
          {flow.docs.map(({ doc, seen: done }) => (
            <ListItem
              key={doc.id}
              leading={<Icon name={docIcon[doc.type]} size={24} />}
              title={`${t.document.type[doc.type]} · v${doc.current.version_no}`}
              subtitle={doc.current.file_name}
              chevron={false}
              trailing={
                done ? (
                  <Badge tone="success" icon="check">
                    {t.detail.seen}
                  </Badge>
                ) : (
                  <span className="text-accent flex items-center gap-0.5 text-subhead font-semibold">
                    {t.approval.look}
                    <Icon name="chev-r" size={16} strokeWidth={2.4} />
                  </span>
                )
              }
              onClick={() => onOpenDocument(doc)}
            />
          ))}
        </ListGroup>
      </section>

      <section key={nudged(flow, "ack")} style={flow.nudge?.step === "ack" ? shake : undefined}>
        <StepTitle>{t.approval.stepAck}</StepTitle>
        <label
          className={cx(
            "bg-surface-2 flex min-h-14 items-start gap-3 rounded-lg px-4 py-3",
            flow.unseen > 0 ? "text-text-3" : "active:bg-surface-3 cursor-pointer",
          )}
        >
          <input
            type="checkbox"
            checked={flow.ack}
            disabled={flow.unseen > 0}
            aria-describedby={flow.unseen > 0 ? "approve-ack-locked" : undefined}
            onChange={(e) => flow.setAck(e.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className={cx(
              "mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2 transition-[background-color,border-color,transform] duration-200",
              "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
              flow.ack
                ? "bg-accent-fill border-accent-fill text-accent-foreground scale-100"
                : "border-separator scale-95",
            )}
          >
            {flow.ack && <Icon name="check" size={16} strokeWidth={3} />}
          </span>
          <span className="text-subhead leading-snug">{t.approval.ack(pkg.version)}</span>
        </label>
        {flow.unseen > 0 && (
          <p
            id="approve-ack-locked"
            className="text-text-3 mt-2 flex items-center gap-1.5 px-1 text-footnote"
          >
            <Icon name="lock" size={15} />
            {t.approval.ackLocked(flow.unseen)}
          </p>
        )}
      </section>

      <Banner tone="neutral" title={t.approval.notPayment} className="mt-5" />
      {/* Says out loud what the shake shows when a locked "Təsdiqlə" is tapped. */}
      <p role="status" className="sr-only">
        {flow.nudge &&
          (flow.nudge.step === "docs" ? t.approval.needDocs : t.approval.needAck) +
            "\u200b".repeat(flow.nudge.n % 2)}
      </p>
    </>
  );
}
