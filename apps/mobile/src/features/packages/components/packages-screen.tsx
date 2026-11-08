"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AppHeader } from "@/components/ui/app-header";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { useDashboard } from "@/features/home/queries";
import { t } from "@/lib/i18n";
import { refreshAll } from "@/lib/refresh";

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
  // The URL's search as last seen, and the one this screen last wrote. A change that is not our
  // own (a tab tap, back, a link) replaces the field; our own must not clobber newer typing.
  const [url, setUrl] = useState({ seen: q, wrote: q });
  if (q !== url.seen) {
    // Once seen, a value is settled: back to it later is an outside change like any other.
    setUrl({ seen: q, wrote: q });
    if (q !== url.wrote) setText(q);
  }

  const navigate = useCallback(
    (f: PackageFilter, query: string) => {
      setUrl((u) => ({ ...u, wrote: query.trim() }));
      router.replace(packagesHref(f, query), { scroll: false });
    },
    [router],
  );

  useEffect(() => {
    if (text.trim() === q) return;
    const timer = setTimeout(() => navigate(filter, text), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, q, filter, navigate]);

  const dashboard = useDashboard();
  const list = usePackages({ status: filterStatuses(filter), q: q || undefined, limit: PAGE });
  const counts = dashboard.data?.status_counts;

  const clear = () => {
    setText("");
    navigate("all", "");
  };

  return (
    <PullToRefresh onRefresh={() => refreshAll([list, dashboard])}>
      <AppHeader
        large
        title={t.packages.title}
        subtitle={dashboard.data ? t.packages.subtitle(dashboard.data.package_count) : undefined}
      />
      <main className="px-safe pb-tabbar pull-shift mx-auto max-w-app">
        <SearchField value={text} onChange={setText} />
        <FilterChips
          value={filter}
          counts={counts && ((f) => filterCount(f, counts))}
          onChange={(f) => navigate(f, text)}
        />
        <div className="mt-2">
          <PackageResults list={list} onClear={clear} />
        </div>
      </main>
    </PullToRefresh>
  );
}
