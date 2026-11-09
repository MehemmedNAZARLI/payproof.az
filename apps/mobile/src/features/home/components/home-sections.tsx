import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { ListGroup, ListItem } from "@/components/ui/list";
import { ListSkeleton, Skeleton } from "@/components/ui/skeleton";
import type { Schemas } from "@/lib/api";
import { formatDateTime, formatMoney } from "@/lib/format";
import { t } from "@/lib/i18n";

/** Open problem amounts, one row per currency — never converted, never summed together. */
export function OpenAmounts({ amounts }: { amounts: Schemas["CurrencyTotal"][] }) {
  return (
    <>
      {amounts.length === 0 ? (
        <Card className="text-text-2 text-footnote">{t.home.noOpen}</Card>
      ) : (
        <ListGroup label={t.home.openAmount}>
          {amounts.map(({ total, package_count }) => (
            <ListItem
              key={total.currency}
              leading={
                <span className="bg-accent-soft text-accent-ink grid size-8 place-items-center rounded-full text-[10px] font-bold">
                  {total.currency}
                </span>
              }
              title={
                <span className="text-headline tabular-nums">
                  {formatMoney(total.amount, total.currency)}
                </span>
              }
              subtitle={t.home.packages(package_count)}
            />
          ))}
        </ListGroup>
      )}
      <p className="text-text-3 mt-2 flex items-start gap-1.5 px-4 text-caption leading-snug">
        <Icon name="info" size={14} className="mt-px shrink-0" />
        {t.home.notLoss}
      </p>
    </>
  );
}

const shortName = (name: string) => {
  const [first = "", last = ""] = name.split(" ");
  return last ? `${first} ${last[0]}.` : first;
};

/** The latest events from the audit log, as in the prototype's "Recent activity". */
export function RecentActivity({ events }: { events: Schemas["AuditEvent"][] }) {
  if (events.length === 0)
    return (
      <Card className="p-0">
        <EmptyState icon="clock" title={t.home.activityEmpty} />
      </Card>
    );
  return (
    <ListGroup label={t.home.activity}>
      {events.map((e) => (
        <ListItem
          key={e.id}
          leading={<Avatar user={e.actor} />}
          title={
            <span className="text-footnote">
              {t.audit.action[e.action] ?? "Package activity updated"}
              {e.package && (
                <span className="text-text-3 font-normal"> · {e.package.invoice_number}</span>
              )}
            </span>
          }
          subtitle={
            <span className="text-caption">
              {e.actor ? shortName(e.actor.full_name) : t.home.system} ·{" "}
              {formatDateTime(e.created_at)}
            </span>
          }
        />
      ))}
    </ListGroup>
  );
}

export function SectionSkeleton({ rows = 2, cards = false }: { rows?: number; cards?: boolean }) {
  if (cards) return <ListSkeleton rows={rows} />;
  return (
    <div aria-hidden="true" className="bg-surface overflow-hidden rounded-lg shadow-1">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex min-h-14 items-center gap-3 px-4 py-3">
          <Skeleton className="size-8 rounded-full" />
          <span className="flex grow flex-col gap-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </span>
        </div>
      ))}
    </div>
  );
}
