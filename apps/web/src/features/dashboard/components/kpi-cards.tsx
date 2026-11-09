import type { Schemas } from "@payproof/api-client";
import { CircleHelp, CircleX, Clock, Package, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Dashboard = Schemas["Dashboard"];

interface Kpi {
  href: string;
  icon: LucideIcon;
  iconClass: string;
  label: string;
  value: number;
  sub: string;
}

const kpis = ({ status_counts: c, package_count, customer_count }: Dashboard): Kpi[] => [
  {
    href: "/packages",
    icon: Package,
    iconClass: "text-text-2",
    label: "Faktura paketləri",
    value: package_count,
    sub: `${customer_count} müştəri · hər faktura bir dəfə sayılır`,
  },
  {
    href: "/packages?status=NEEDS_REVIEW",
    icon: CircleHelp,
    iconClass: "text-warning",
    label: "Yoxlama tələb edir",
    value: c.NEEDS_REVIEW,
    sub: `İnsan yoxlaması lazımdır${c.PROCESSING ? ` · ${c.PROCESSING} emal olunur` : ""}`,
  },
  {
    href: "/packages?status=NEEDS_FIX",
    icon: CircleX,
    iconClass: "text-danger",
    label: "Düzəliş tələb edir",
    value: c.NEEDS_FIX,
    sub: "Təsdiqlənmiş uyğunsuzluq var",
  },
  {
    href: "/packages?status=READY_FOR_APPROVAL",
    icon: Clock,
    iconClass: "text-brand",
    label: "Təsdiq gözləyir",
    value: c.READY_FOR_APPROVAL,
    sub: `Göndərilməyə hazır: ${c.APPROVED_READY} · ixrac edilib: ${c.EXPORTED}`,
  },
];

/** Prototype `.kpis`: each card opens the package list with its filter. */
export function KpiCards({ dashboard }: { dashboard: Dashboard }) {
  return (
    <ul aria-label="Əsas göstəricilər" className="grid gap-4 @lg:grid-cols-2 @4xl:grid-cols-4">
      {kpis(dashboard).map(({ href, icon: Icon, iconClass, label, value, sub }) => (
        <li key={href}>
          <Link
            href={href}
            className="bg-surface border-border shadow-1 hover:border-border-strong hover:shadow-2 focus-visible:ring-ring flex h-full flex-col gap-1 rounded-lg border p-5 outline-none transition duration-base ease-base focus-visible:ring-2"
          >
            <span className="text-text-2 flex items-center gap-1.5 text-sm font-semibold">
              <Icon aria-hidden className={cn("size-4", iconClass)} />
              {label}
            </span>
            <span className="text-4xl leading-tight font-extrabold tracking-tight tabular-nums">
              {value}
            </span>
            <span className="text-text-3 text-xs">{sub}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
