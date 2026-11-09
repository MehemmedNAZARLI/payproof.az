import type { Schemas } from "@payproof/api-client";
import { Building2, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { DateTime, Money } from "@/components/format";
import { PackageStatusBadge } from "@/components/status/status-badges";
import { shellText } from "@payproof/api-client/i18n";
import { detailText as t } from "../texts";

type Pkg = Schemas["PackageDetail"];

const Fact = ({ label, children }: { label?: string; children: ReactNode }) => (
  <li>
    {label && `${label}: `}
    <b className="text-text">{children}</b>
  </li>
);

/** Breadcrumb + title row (prototype `.crumb`, `.pd-head`); `actions` sits on the right. */
export function PackageHeader({ pkg, actions }: { pkg: Pkg; actions?: ReactNode }) {
  const title = pkg.invoice_number ?? t.processingTitle;
  return (
    <div>
      <nav aria-label={t.breadcrumb} className="text-text-3 flex items-center gap-1.5 text-sm">
        <Link href="/packages" className="hover:text-text hover:underline">
          {shellText.nav.packages}
        </Link>
        <ChevronRight aria-hidden className="size-3.5" />
        <span aria-current="page">{title}</span>
      </nav>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl leading-tight font-bold tracking-tight">{title}</h1>
            <PackageStatusBadge status={pkg.status} />
            <span className="bg-surface-2 text-text-2 border-border rounded-sm border px-1.5 py-px text-[11px] font-bold">
              {t.version(pkg.version)}
            </span>
          </div>
          <ul
            aria-label={t.meta}
            className="text-text-2 mt-1.5 flex flex-wrap gap-x-4 gap-y-2 text-sm"
          >
            <li className="flex items-center gap-1">
              <Building2 aria-hidden className="size-4" />
              <b className="text-text">{pkg.customer.name}</b>
            </li>
            {pkg.total && (
              <Fact label={t.amount}>
                <Money {...pkg.total} />
              </Fact>
            )}
            {pkg.invoice_date && (
              <Fact label={t.date}>
                <DateTime value={pkg.invoice_date} format="date" />
              </Fact>
            )}
            <Fact label={t.ruleSet}>{`v${pkg.requirement_set.version}`}</Fact>
            <Fact label={t.owner}>{pkg.owner.full_name}</Fact>
          </ul>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
