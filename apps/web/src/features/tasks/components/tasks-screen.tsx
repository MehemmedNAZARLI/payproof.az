"use client";

import { taskStatusLabel, ui } from "@payproof/api-client/i18n";
import { ListChecks } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Banner, EmptyState, PageHeader } from "@/components/ui/layout";
import { SkeletonTable } from "@/components/ui/skeleton";
import { useCan } from "@/features/auth";
import { useAssignableUsers } from "@/features/users";
import { cn } from "@/lib/utils";
import { useTasks, type TaskFilter, type TaskTab } from "../queries";
import { taskColumns } from "./task-columns";

const TABS: { value: TaskTab; label: string }[] = [
  { value: "active", label: "Aktiv" },
  { value: "OPEN", label: taskStatusLabel.OPEN },
  { value: "IN_PROGRESS", label: taskStatusLabel.IN_PROGRESS },
  { value: "SUBMITTED_FOR_RECHECK", label: taskStatusLabel.SUBMITTED_FOR_RECHECK },
  { value: "RESOLVED", label: taskStatusLabel.RESOLVED },
  { value: "", label: "Hamısı" },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** URL → filter; anything unknown falls back to the default tab (a shared link never breaks). */
export function taskFilter(q: URLSearchParams): TaskFilter {
  const raw = q.get("status") ?? "active";
  const status = raw === "all" ? "" : raw; // "" cannot travel in a URL
  return {
    status: TABS.some((t) => t.value === status) ? (status as TaskTab) : "active",
    // a hand-edited link must not send garbage to the API
    assignee: UUID.test(q.get("assignee") ?? "") ? q.get("assignee")! : "",
  };
}

export function TasksScreen() {
  const router = useRouter();
  const filter = taskFilter(new URLSearchParams(useSearchParams().toString()));
  const tasks = useTasks(filter);
  const users = useAssignableUsers();
  const canManage = useCan("MANAGE_TASKS");
  const go = (next: TaskFilter) => {
    const q = new URLSearchParams();
    if (next.status !== "active") q.set("status", next.status || "all");
    if (next.assignee) q.set("assignee", next.assignee);
    router.push(`/tasks${q.size ? `?${q}` : ""}`, { scroll: false });
  };
  const c = tasks.data?.status_counts;
  const count = (tab: TaskTab) =>
    !c
      ? null
      : tab === "active"
        ? c.OPEN + c.IN_PROGRESS + c.SUBMITTED_FOR_RECHECK
        : tab === ""
          ? c.OPEN + c.IN_PROGRESS + c.SUBMITTED_FOR_RECHECK + c.RESOLVED
          : c[tab];

  return (
    <>
      <PageHeader
        title="Tapşırıqlar"
        description="Hər tapşırıq bir yoxlama nəticəsinə bağlıdır. “Düzəltdim” demək tapşırığı həll etmir — uyğun yoxlama keçəndə sistem onu avtomatik bağlayır."
      />
      <section className="bg-surface border-border shadow-1 min-w-0 rounded-lg border">
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b p-3">
          {/* tabs filter one list (no separate panels): a group of toggle buttons */}
          <div
            role="group"
            aria-label="Status"
            tabIndex={-1}
            data-focus-fallback // where focus lands when an acted-on row leaves the list
            className="flex flex-wrap gap-1 outline-none"
          >
            {TABS.map((t) => (
              <Button
                key={t.label}
                size="sm"
                variant={filter.status === t.value ? "secondary" : "ghost"}
                aria-pressed={filter.status === t.value}
                onClick={() => go({ ...filter, status: t.value })}
              >
                {t.label}
                {count(t.value) !== null && (
                  <span className="text-text-3 tabular-nums">{count(t.value)}</span>
                )}
              </Button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">Məsul şəxs</span>
            <select
              value={filter.assignee}
              onChange={(e) => go({ ...filter, assignee: e.target.value })}
              className="border-border-strong bg-surface focus-visible:ring-ring rounded-md border px-3 py-1.5 outline-none focus-visible:ring-2 pointer-coarse:min-h-11"
            >
              <option value="">Məsul: hamısı</option>
              {users.data?.map((u) => (
                <option key={u.id} value={u.id}>{`${u.full_name} · ${u.title}`}</option>
              ))}
            </select>
          </label>
        </div>
        {tasks.isPending && <SkeletonTable rows={5} columns={7} />}
        {tasks.isError && (
          <Banner
            tone="danger"
            role="alert"
            title={ui.errorTitle}
            className="m-4"
            actions={
              <Button variant="outline" onClick={() => tasks.refetch()}>
                {ui.retry}
              </Button>
            }
          >
            {tasks.error.message}
          </Banner>
        )}
        {tasks.data && (
          <div
            aria-busy={tasks.isPlaceholderData}
            className={cn(tasks.isPlaceholderData && "opacity-60")}
          >
            <DataTable
              caption="Tapşırıqlar"
              columns={taskColumns(canManage)}
              data={tasks.data.items}
              getRowId={(t) => t.id}
              empty={
                <EmptyState
                  icon={ListChecks}
                  title="Bu filtrdə tapşırıq yoxdur"
                  description="Tapşırıq paketin yoxlama nəticəsindən yaradılır: problemin yanındakı “Tapşırıq yarat” düyməsinə basın."
                />
              }
            />
          </div>
        )}
      </section>
    </>
  );
}
