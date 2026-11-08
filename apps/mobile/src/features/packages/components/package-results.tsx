import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListGroup } from "@/components/ui/list";
import { OfflineCard } from "@/components/ui/offline-card";
import { ListSkeleton } from "@/components/ui/skeleton";
import { t } from "@/lib/i18n";
import { errorMessage } from "@/lib/query-client";

import type { usePackages } from "../queries";
import { PackageRow } from "./package-row";

type PackageResultsProps = {
  list: ReturnType<typeof usePackages>;
  /** Clears the search and filter (the empty result's action). */
  onClear: () => void;
};

// The list area's states: offline, loading, error, nothing found, rows.
export function PackageResults({ list, onClear: clear }: PackageResultsProps) {
  const { data } = list;
  // Loaded rows stay through refreshes (pull-to-refresh shows its own spinner); a failed
  // background refresh is reported by a toast.
  return (
    <>
      {!data ? (
        list.fetchStatus === "fetching" ? (
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
          <OfflineCard />
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
