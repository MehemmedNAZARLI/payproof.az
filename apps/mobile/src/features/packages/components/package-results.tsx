import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListGroup } from "@/components/ui/list";
import { ListSkeleton } from "@/components/ui/skeleton";
import { t } from "@/lib/i18n";
import { errorMessage } from "@/lib/query-client";

import type { usePackages } from "../queries";
import { PackageRow } from "./package-row";

type PackageResultsProps = {
  list: ReturnType<typeof usePackages>;
  /** A pull of fresh data the user asked for: show the skeleton, as the prototype does. */
  refreshing: boolean;
  onClear: () => void;
};

// The list area's states: offline, loading, error, nothing found, rows.
export function PackageResults({ list, refreshing, onClear: clear }: PackageResultsProps) {
  const { data } = list;
  // A refresh the user asked for shows the skeleton while it really fetches (not while it waits
  // offline). Loaded rows otherwise stay: a failed background refresh is reported by a toast.
  const reloading = refreshing && list.fetchStatus === "fetching";
  return (
    <>
      {!data || reloading ? (
        data || list.fetchStatus === "fetching" ? (
          <ListSkeleton rows={5} />
        ) : list.isError ? (
          <Card className="p-0">
            <EmptyState
              icon="alert"
              title={t.errors.loadFailed}
              description={errorMessage(list.error)}
              action={
                <Button variant="secondary" onClick={() => void list.refetch()}>
                  {t.common.retry}
                </Button>
              }
            />
          </Card>
        ) : list.fetchStatus === "paused" ? (
          <Card className="p-0">
            <EmptyState icon="alert" title={t.errors.offline} description={t.errors.offlineHint} />
          </Card>
        ) : (
          <ListSkeleton rows={5} />
        )
      ) : data.items.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon="search"
            title={t.packages.emptyTitle}
            description={t.packages.emptyHint}
            action={
              <Button variant="secondary" onClick={clear}>
                {t.packages.clearFilters}
              </Button>
            }
          />
        </Card>
      ) : (
        <ListGroup variant="cards" label={t.packages.list}>
          {data.items.map((p) => (
            <PackageRow key={p.id} item={p} />
          ))}
        </ListGroup>
      )}
      <p role="status" className="sr-only">
        {list.data && !list.isPlaceholderData ? t.packages.results(list.data.items.length) : ""}
      </p>
    </>
  );
}
