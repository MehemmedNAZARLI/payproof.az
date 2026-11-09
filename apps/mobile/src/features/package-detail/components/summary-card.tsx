import { PackageStatusBadge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import type { Schemas } from "@/lib/api";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { t } from "@/lib/i18n";

const Tag = ({ children }: { children: string }) => (
  <span className="bg-hero-fill inline-flex h-6 items-center rounded-full px-2.5 text-caption font-medium tabular-nums">
    {children}
  </span>
);

// The package at a glance (prototype mPackage summary card): amount, status, the version and
// rule set an approval would be bound to, and who approved the current version. Drawn as the
// navy hero card: the amount is what an approver signs off on.
export function SummaryCard({ pkg }: { pkg: Schemas["PackageDetail"] }) {
  const approval = pkg.current_approval;
  return (
    <div className="hero rounded-xl p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-hero-text2 text-footnote font-medium">{t.detail.amount}</span>
        <PackageStatusBadge status={pkg.status} />
      </div>
      <p className="mt-2 text-[34px] leading-[41px] font-bold tracking-[-0.8px] tabular-nums">
        {pkg.total ? formatMoney(pkg.total.amount, pkg.total.currency) : "—"}
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        <Tag>{t.detail.packageVersion(pkg.version)}</Tag>
        <Tag>{t.detail.ruleSet(pkg.requirement_set.version)}</Tag>
        {pkg.invoice_date && <Tag>{formatDate(pkg.invoice_date)}</Tag>}
      </div>
      {approval && (
        <p className="text-hero-text2 mt-4 flex items-center gap-2 border-t-[0.5px] border-white/15 pt-3 text-footnote">
          <Icon name="pass" size={18} className="shrink-0 text-[#4ade96]" />
          <span>
            {t.detail.approvedBy}:{" "}
            <b className="font-semibold text-white">{approval.approver.full_name}</b>
            {" · "}
            {formatDateTime(approval.approved_at)}
          </span>
        </p>
      )}
    </div>
  );
}
