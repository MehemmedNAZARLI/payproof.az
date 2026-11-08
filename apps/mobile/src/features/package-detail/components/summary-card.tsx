import { PackageStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import type { Schemas } from "@/lib/api";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { t } from "@/lib/i18n";

const Tag = ({ children }: { children: string }) => (
  <span className="bg-surface-2 text-text-2 inline-flex h-6 items-center rounded-sm px-2 text-xs font-medium tabular-nums">
    {children}
  </span>
);

// The package at a glance (prototype mPackage summary card): amount, status, the version and
// rule set an approval would be bound to, and who approved the current version.
export function SummaryCard({ pkg }: { pkg: Schemas["PackageDetail"] }) {
  const approval = pkg.current_approval;
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <span className="text-text-3 text-sm">{t.detail.amount}</span>
        <PackageStatusBadge status={pkg.status} />
      </div>
      <p className="mt-1 text-[30px] leading-tight font-bold tracking-tight tabular-nums">
        {pkg.total ? formatMoney(pkg.total.amount, pkg.total.currency) : "—"}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Tag>{t.detail.packageVersion(pkg.version)}</Tag>
        <Tag>{t.detail.ruleSet(pkg.requirement_set.version)}</Tag>
        {pkg.invoice_date && <Tag>{formatDate(pkg.invoice_date)}</Tag>}
      </div>
      {approval && (
        <p className="text-text-2 hairline-t mt-3 flex items-center gap-2 pt-3 text-sm">
          <Icon name="pass" size={18} className="text-success shrink-0" />
          <span>
            {t.detail.approvedBy}:{" "}
            <b className="text-text font-semibold">{approval.approver.full_name}</b>
            {" · "}
            {formatDateTime(approval.approved_at)}
          </span>
        </p>
      )}
    </Card>
  );
}
