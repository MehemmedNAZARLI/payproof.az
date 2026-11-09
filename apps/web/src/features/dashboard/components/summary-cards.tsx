import type { Schemas } from "@payproof/api-client";
import { ui } from "@payproof/api-client/i18n";
import { Info } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Money } from "@/components/format";
import { Panel } from "@/components/ui/layout";

type Dashboard = Schemas["Dashboard"];

const Big = ({ children }: { children: ReactNode }) => (
  <div className="text-2xl font-extrabold tracking-tight tabular-nums">{children}</div>
);
const Divider = () => <hr className="border-border my-4" />;
const None = () => <p className="text-text-2">Açıq problem yoxdur.</p>;

/** Open problem amounts, top issue and problem age (prototype `.g3`). */
export function SummaryCards({ dashboard: d }: { dashboard: Dashboard }) {
  const { longest } = d.problem_age;
  return (
    <div className="grid gap-4 @4xl:grid-cols-3">
      <Panel title="Açıq problemli faktura məbləği">
        {d.open_problem_amounts.length ? (
          // one row per currency: amounts are summed on the server and never across currencies
          d.open_problem_amounts.map(({ total, package_count }) => (
            <div
              key={total.currency}
              className="border-border flex items-baseline justify-between gap-2 border-b py-2.5 last-of-type:border-b-0"
            >
              <span className="text-text-2 text-sm">{`${total.currency} · ${package_count} paket`}</span>
              <Money {...total} className="text-2xl font-extrabold" />
            </div>
          ))
        ) : (
          <p className="text-text-2">Açıq problemli paket yoxdur.</p>
        )}
        <p className="text-text-3 mt-2 text-xs">{ui.problemAmountHint}</p>
      </Panel>

      <Panel title="Ən çox təkrarlanan problem">
        {d.top_issue ? (
          <>
            <Big>{d.top_issue.category}</Big>
            <p className="text-text-2 mt-1 text-sm">
              {`${d.top_issue.package_count} paketdə: ${d.top_issue.invoice_numbers.join(", ")}`}
            </p>
          </>
        ) : (
          <None />
        )}
        <Divider />
        <div className="flex justify-between text-sm">
          <span className="text-text-2">Tapşırıqlar</span>
          <b>{`${d.tasks.resolved} / ${d.tasks.total} həll edilib`}</b>
        </div>
      </Panel>

      <Panel title="Problemdə qalma müddəti">
        <Big>
          {/* "3.0" from the API → Azerbaijani decimal comma */}
          {`${d.problem_age.average_days.replace(".", ",")} gün`}{" "}
          <span className="text-text-3 text-sm font-semibold">orta</span>
        </Big>
        {longest ? (
          <p className="text-text-2 mt-1 text-sm">
            Ən uzun:{" "}
            <Link
              href={`/packages/${longest.package.id}`}
              className="text-brand font-semibold hover:underline pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
            >
              {longest.package.invoice_number}
            </Link>
            {` — ${longest.days} gün`}
          </p>
        ) : (
          <None />
        )}
        <Divider />
        <p className="text-text-3 flex gap-1.5 text-xs">
          <Info aria-hidden className="size-4 shrink-0" />
          Aktiv yoxlama vaxtı və vaxt qənaəti hələ ölçülməyib — pilotda ayrıca ölçüləcək.
        </p>
      </Panel>
    </div>
  );
}
