import { PackageStatusBadge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { ListItem } from "@/components/ui/list";
import { usePackage } from "@/features/package-detail/queries";
import type { Schemas } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { t } from "@/lib/i18n";

// One package in an inset grouped list (prototype mItem): number, amount, customer · version, status
// and how many problems block it.
export function PackageRow({ item: p, href }: { item: Schemas["PackageListItem"]; href?: string }) {
  const detail = usePackage(p.id).data;
  return (
    <ListItem
      href={href ?? `/packages/${p.id}`}
      title={p.invoice_number ?? t.packageItem.processing}
      subtitle={
        <>
          <span className="block">
            {p.customer.name} · v{p.version}
          </span>
          <span className="text-text-3 mt-1 block text-caption">
            {p.status === "PROCESSING"
              ? "AI reading documents…"
              : detail
                ? `${detail.checks.length} checks · ${detail.summary.fail + detail.summary.unknown} issues · AI-read`
                : `${p.blocking.length} issues · Loading checks…`}
          </span>
        </>
      }
      trailing={
        p.total && (
          <span className="text-callout font-semibold tabular-nums">
            {formatMoney(p.total.amount, p.total.currency)}
          </span>
        )
      }
      meta={
        <>
          <PackageStatusBadge status={p.status} />
          {p.blocking.length > 0 && (
            <span className="text-danger-ink inline-flex items-center gap-1 text-caption font-semibold">
              <Icon name="alert" size={14} />
              {t.packageItem.blocking(p.blocking.length)}
            </span>
          )}
        </>
      }
    />
  );
}
