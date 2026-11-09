import { mockIds } from "@payproof/mocks";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, expect, test } from "vitest";
import { setToken } from "@/lib/auth";
import { renderHookWithQuery, testQueryClient } from "@/test/render";
import { useAdvanceTask, useCancelTask, useCreateTask } from "./mutations";
import { useTasks } from "./queries";

beforeEach(() => setToken(`mock.${mockIds.user("u1")}`));

test("create → take → submit: a rule that still fails sends the task back to work", async () => {
  const client = testQueryClient();
  const pkg = mockIds.pkg("pkg_1042");
  const create = renderHookWithQuery(() => useCreateTask(pkg), client).result;
  const task = await act(() =>
    create.current.mutateAsync({
      rule_id: "R-007",
      assignee_id: mockIds.user("u3"),
      step: "İmzalı təhvil aktını yükləyin.",
      due_date: "2026-11-10",
    }),
  );
  expect(task.status).toBe("OPEN");
  const advance = renderHookWithQuery(() => useAdvanceTask(), client).result;
  const started = await act(() => advance.current.mutateAsync({ task, status: "IN_PROGRESS" }));
  expect(started.status).toBe("IN_PROGRESS");
  const submitted = await act(() =>
    advance.current.mutateAsync({ task: started, status: "SUBMITTED_FOR_RECHECK" }),
  );
  expect(submitted.status).toBe("IN_PROGRESS"); // R-007 still fails: back to work, not resolved
});

test("a second open task for the same rule is refused (TASK_ALREADY_OPEN)", async () => {
  const create = renderHookWithQuery(() => useCreateTask(mockIds.pkg("pkg_1042"))).result;
  const body = {
    rule_id: "R-001",
    assignee_id: mockIds.user("u6"),
    step: "PO-nu əlavə edin.",
    due_date: "2026-11-10",
  };
  await act(() => create.current.mutateAsync(body));
  await expect(act(() => create.current.mutateAsync(body))).rejects.toMatchObject({
    code: "TASK_ALREADY_OPEN",
  });
});

test("cancel removes the task from the active list; 'all' merges active and resolved", async () => {
  const client = testQueryClient();
  const list = renderHookWithQuery(() => useTasks({ status: "active", assignee: "" }), client);
  await waitFor(() => expect(list.result.current.data).toBeDefined());
  const before = list.result.current.data!.items;
  const cancel = renderHookWithQuery(() => useCancelTask(), client).result;
  await act(() => cancel.current.mutateAsync(before[0]!));
  await waitFor(() => expect(list.result.current.data!.items).toHaveLength(before.length - 1));
  const all = renderHookWithQuery(() => useTasks({ status: "", assignee: "" }), client);
  await waitFor(() => expect(all.result.current.data).toBeDefined());
  const c = all.result.current.data!.status_counts;
  expect(all.result.current.data!.items).toHaveLength(
    c.OPEN + c.IN_PROGRESS + c.SUBMITTED_FOR_RECHECK + c.RESOLVED,
  );
});
