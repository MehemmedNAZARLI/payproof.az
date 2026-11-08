import { PackageStatusBadge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { ListItem } from "@/components/ui/list";
import type { Schemas } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { t } from "@/lib/i18n";

// One package in a "cards" list (prototype mItem): number, amount, customer · version, status
// and how many problems block it.
export function PackageRow({ item: p, href }: { item: Schemas["PackageListItem"]; href?: string }) {
  return (
    <ListItem
      href={href ?? `/packages/${p.id}`}
      title={p.invoice_number ?? t.packageItem.processing}
      subtitle={`${p.customer.name} · v${p.version}`}
      trailing={
        p.total && (
          <span className="text-sm font-bold tabular-nums">
            {formatMoney(p.total.amount, p.total.currency)}
          </span>
        )
      }
      meta={
        <>
          <PackageStatusBadge status={p.status} />
          {p.blocking.length > 0 && (
            <span className="text-danger inline-flex items-center gap-1 text-xs font-semibold">
              <Icon name="alert" size={14} />
              {t.packageItem.blocking(p.blocking.length)}
            </span>
          )}
        </>
      }
    />
  );
}
