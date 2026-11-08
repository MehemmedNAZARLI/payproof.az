import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { OfflineCard } from "@/components/ui/offline-card";
import { t } from "@/lib/i18n";
import { errorMessage } from "@/lib/query-client";

type SectionQuery<T> = {
  data: T | undefined;
  error: Error | null;
  fetchStatus: "fetching" | "paused" | "idle";
  refetch: () => unknown;
};

// Each section loads and fails on its own, so one slow endpoint does not blank the screen.
export function Section<T>(props: {
  query: SectionQuery<T>;
  skeleton: ReactNode;
  children: (data: T) => ReactNode;
}) {
  const { query, skeleton, children } = props;
  if (query.data !== undefined) return children(query.data);
  if (query.fetchStatus === "paused") return <OfflineCard />;
  if (query.error) return <LoadError error={query.error} retry={() => void query.refetch()} />;
  return skeleton;
}

export function LoadError({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <Card className="p-0">
      <EmptyState
        icon="alert"
        title={t.home.loadFailed}
        description={errorMessage(error)}
        action={
          <Button variant="secondary" onClick={retry}>
            {t.common.retry}
          </Button>
        }
      />
    </Card>
  );
}
