"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, SectionHeader } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { ListGroup } from "@/components/ui/list";
import { ListSkeleton } from "@/components/ui/skeleton";
import { PackageRow } from "@/features/packages/components/package-row";
import { usePackages } from "@/features/packages/queries";
import type { PackageListQuery } from "@/lib/api";
import { cx } from "@/lib/cx";
import { type PackageStatus, t } from "@/lib/i18n";
import { errorMessage } from "@/lib/query-client";

// The prototype's mobile filter chips (M_CHIPS).
const filters: [Exclude<keyof typeof t.packageFilter, "label">, PackageStatus[] | undefined][] = [
  ["all", undefined],
  ["ready", ["READY_FOR_APPROVAL"]],
  ["problem", ["NEEDS_FIX", "NEEDS_REVIEW"]],
  ["approved", ["APPROVED_READY"]],
  ["exported", ["EXPORTED"]],
];
const SHOWN = 4;
const ALL: PackageListQuery = { limit: 200 };

// Live data from the in-page mock API: chips filter through the real query parameters.
export function LivePackagesSection() {
  const [filter, setFilter] = useState(0);
  const status = filters[filter]?.[1];
  const all = usePackages(ALL);
  const list = usePackages({ status, limit: SHOWN });
  const count = (s?: PackageStatus[]) =>
    all.data?.items.filter((p) => !s || s.includes(p.status)).length;

  return (
    <>
      <div
        role="group"
        aria-label={t.packageFilter.label}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none]"
      >
        {filters.map(([key, s], i) => (
          <Chip key={key} pressed={filter === i} count={count(s)} onClick={() => setFilter(i)}>
            {t.packageFilter[key]}
          </Chip>
        ))}
      </div>
      <SectionHeader
        title={t.nav.packages}
        action={
          <IconButton
            icon="refresh"
            label={t.common.refresh}
            onClick={() => void list.refetch()}
            className={cx(list.isFetching && "[&_svg]:animate-spin")}
          />
        }
      />
      {list.isPending && list.fetchStatus === "paused" ? (
        <Card className="p-0">
          <EmptyState icon="alert" title={t.errors.offline} description={t.errors.offlineHint} />
        </Card>
      ) : list.isPending ? (
        <ListSkeleton rows={SHOWN} />
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
      ) : list.data.items.length === 0 ? (
        <Card className="p-0">
          <EmptyState icon="package" title={t.common.empty} />
        </Card>
      ) : (
        <ListGroup label={t.nav.packages}>
          {list.data.items.map((p) => (
            <PackageRow key={p.id} item={p} href="/kit" />
          ))}
        </ListGroup>
      )}
    </>
  );
}
