import { SectionHeader } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icon";
import { ListGroup, ListItem } from "@/components/ui/list";
import type { Schemas } from "@/lib/api";
import { cx } from "@/lib/cx";
import { checkTitle } from "@/lib/english";
import { type CheckOutcome, t } from "@/lib/i18n";

const outcomeIcon: Record<CheckOutcome, { name: IconName; className: string }> = {
  PASS: { name: "pass", className: "text-success-ink" },
  FAIL: { name: "fail", className: "text-danger-ink" },
  UNKNOWN: { name: "unknown", className: "text-warning-ink" },
  NOT_APPLICABLE: { name: "na", className: "text-text-3" },
};

export function OutcomeIcon({ outcome, size = 24 }: { outcome: CheckOutcome; size?: number }) {
  const icon = outcomeIcon[outcome];
  return (
    <Icon name={icon.name} size={size} strokeWidth={2} className={cx("shrink-0", icon.className)} />
  );
}

type ChecksListProps = {
  pkg: Schemas["PackageDetail"];
  onOpen?: (check: Schemas["CheckResult"]) => void;
};

// Every rule result, in rule order; the outcome is in the icon and in words.
export function ChecksList({ pkg, onOpen }: ChecksListProps) {
  const { summary } = pkg;
  return (
    <section aria-labelledby="checks-title">
      <SectionHeader
        id="checks-title"
        title={t.detail.checks}
        action={
          <span className="text-text-3 pb-1 text-footnote">
            {t.detail.checksSummary(summary.pass, summary.fail + summary.unknown)}
          </span>
        }
      />
      <ListGroup label={t.detail.checks}>
        {pkg.checks.map((c) => (
          <ListItem
            key={c.rule_id}
            multiline
            leading={<OutcomeIcon outcome={c.outcome} />}
            title={checkTitle(c)}
            subtitle={`${c.rule_id} · ${t.check.outcome[c.outcome]}`}
            onClick={onOpen && (() => onOpen(c))}
          />
        ))}
      </ListGroup>
    </section>
  );
}
