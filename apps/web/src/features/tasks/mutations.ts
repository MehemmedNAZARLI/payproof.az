import { unwrap, type ApiError, type Schemas } from "@payproof/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { dashboardKeys } from "@/features/dashboard";
import { packageKeys } from "@/features/packages";
import { api } from "@/lib/api";
import { taskKeys } from "./queries";

type Task = Schemas["Task"];

/** Tasks show in the list, the sidebar badge, the package detail and the dashboard. */
function useRefresh() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: taskKeys.all }),
      client.invalidateQueries({ queryKey: packageKeys.all }),
      client.invalidateQueries({ queryKey: dashboardKeys.all }),
    ]);
}

export interface NewTask {
  rule_id: string;
  assignee_id: string;
  step: string;
  due_date: string;
  comment?: string;
}

export function useCreateTask(packageId: string) {
  const refresh = useRefresh();
  return useMutation<Task, ApiError, NewTask>({
    mutationFn: (body) =>
      unwrap(
        api.POST("/v1/packages/{package_id}/tasks", {
          params: { path: { package_id: packageId } },
          body,
        }),
      ),
    onSettled: refresh, // also after TASK_ALREADY_OPEN: show the task that exists
  });
}

/** Moves a task one step forward; RESOLVED is never sent — only the system sets it. */
export function useAdvanceTask() {
  const refresh = useRefresh();
  return useMutation<
    Task,
    ApiError,
    { task: Task; status: "IN_PROGRESS" | "SUBMITTED_FOR_RECHECK" }
  >({
    mutationFn: ({ task, status }) =>
      unwrap(
        api.PATCH("/v1/tasks/{task_id}", {
          params: { path: { task_id: task.id } },
          body: { status },
        }),
      ),
    onSettled: refresh,
  });
}

export function useCancelTask() {
  const refresh = useRefresh();
  return useMutation<unknown, ApiError, Task>({
    mutationFn: (task) =>
      unwrap(api.DELETE("/v1/tasks/{task_id}", { params: { path: { task_id: task.id } } })),
    onSettled: refresh,
  });
}
