import { unwrap, type Schemas } from "@payproof/api-client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const taskKeys = {
  all: ["tasks"] as const,
  // own key: a limit=1 response must never be mistaken for the task list (W-12)
  openCount: () => [...taskKeys.all, "open-count"] as const,
  list: (f: TaskFilter) => [...taskKeys.all, "list", f] as const,
};

/** Tabs: `active` = not resolved, "" = everything (no status filter). */
export type TaskTab = "active" | "" | Schemas["TaskStatus"];
export interface TaskFilter {
  status: TaskTab;
  assignee: string;
}

/** The task list; `status_counts` ignore the tab, so every tab shows its count. */
export const useTasks = (f: TaskFilter) =>
  useQuery({
    queryKey: taskKeys.list(f),
    queryFn: async ({ signal }) => {
      const page = (status: Exclude<TaskTab, "">) =>
        unwrap(
          api.GET("/v1/tasks", {
            // shortcut: one page of 100 is enough for the demo; cursor paging when lists grow
            params: { query: { status, assignee_id: f.assignee || undefined, limit: 100 } },
            signal,
          }),
        );
      if (f.status) return page(f.status);
      // the API has no "all" (omitting status means active): open ones first, then resolved
      const [active, resolved] = await Promise.all([page("active"), page("RESOLVED")]);
      return { ...active, items: [...active.items, ...resolved.items] };
    },
    placeholderData: keepPreviousData,
  });

/** Sidebar badge: tasks not yet RESOLVED, from the list's `status_counts` (one item is enough). */
export const useOpenTaskCount = () =>
  useQuery({
    queryKey: taskKeys.openCount(),
    queryFn: ({ signal }) =>
      unwrap(api.GET("/v1/tasks", { params: { query: { status: "active", limit: 1 } }, signal })),
    select: ({ status_counts: c }) => c.OPEN + c.IN_PROGRESS + c.SUBMITTED_FOR_RECHECK,
  });
