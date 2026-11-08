"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AppHeader } from "@/components/ui/app-header";
import { IconButton } from "@/components/ui/icon-button";
import { useDashboard } from "@/features/home/queries";
import { cx } from "@/lib/cx";
import { t } from "@/lib/i18n";

import {
  filterCount,
  filterStatuses,
  type PackageFilter,
  packagesHref,
  parseFilter,
} from "../filters";
import { usePackages } from "../queries";
import { FilterChips } from "./filter-chips";
import { PackageResults } from "./package-results";
import { SearchField } from "./search-field";

const SEARCH_DELAY_MS = 250;
const PAGE = 100;

export function PackagesScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const filter = parseFilter(params.get("status"));
  const q = params.get("q") ?? "";
  // The field answers every keystroke; the URL (and the request) follow once typing pauses.
  const [text, setText] = useState(q);
  const [refreshing, setRefreshing] = useState(false);

  const navigate = (f: PackageFilter, query: string) =>
    router.replace(packagesHref(f, query), { scroll: false });

  useEffect(() => {
    if (text.trim() === q) return;
    const timer = setTimeout(
      () => router.replace(packagesHref(filter, text), { scroll: false }),
      SEARCH_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [text, q, filter, router]);

  const dashboard = useDashboard();
  const list = usePackages({ status: filterStatuses(filter), q: q || undefined, limit: PAGE });
  const counts = dashboard.data?.status_counts;

  const refresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([list.refetch(), dashboard.refetch()]);
    setRefreshing(false);
  };
  const clear = () => {
    setText("");
    navigate("all", "");
  };

  return (
    <>
      <AppHeader
        large
        title={t.packages.title}
        subtitle={dashboard.data ? t.packages.subtitle(dashboard.data.package_count) : undefined}
        trailing={
          <IconButton
            icon="refresh"
            label={t.common.refresh}
            onClick={() => void refresh()}
            disabled={refreshing}
            className={cx(list.isFetching && "[&_svg]:animate-spin")}
          />
        }
      />
      <main className="px-safe pb-tabbar mx-auto max-w-app">
        <SearchField value={text} onChange={setText} />
        <FilterChips
          value={filter}
          counts={counts && ((f) => filterCount(f, counts))}
          onChange={(f) => navigate(f, text)}
        />
        <div className="mt-2">
          <PackageResults list={list} refreshing={refreshing} onClear={clear} />
        </div>
      </main>
    </>
  );
}
