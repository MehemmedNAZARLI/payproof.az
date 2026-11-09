import { unwrap } from "@payproof/api-client";
import { describe, expect, it } from "vitest";
import { id } from "../src/ids";
import { as, mock, pkgId } from "./api";
import { assertSchema } from "./contract";

const T = (n: number) => ({ params: { path: { task_id: id.task(`T-${n}`) } } });

describe("task handlers", () => {
  it("creates a task (201) for an assignee", async () => {
    const api = await as("u1");
    const t = await unwrap(
      api.POST("/v1/packages/{package_id}/tasks", {
        params: { path: { package_id: pkgId(1042) } },
        body: {
          rule_id: "R-001",
          assignee_id: id.user("u6"),
          step: "PO-381 əlavə edin",
          due_date: "2026-11-09",
        },
      }),
    );
    assertSchema("Task", t);
    expect(t).toMatchObject({ number: "T-124", status: "OPEN", assignee: { role: "assignee" } });
  });

  it("a second open task for the same rule → 409 TASK_ALREADY_OPEN", async () => {
    const api = await as("u1");
    await expect(
      api.POST("/v1/packages/{package_id}/tasks", {
        params: { path: { package_id: pkgId(1043) } },
        body: {
          rule_id: "R-002",
          assignee_id: id.user("u6"),
          step: "Düzəldin",
          due_date: "2026-11-09",
        },
      }),
    ).rejects.toMatchObject({ code: "TASK_ALREADY_OPEN", status: 409 });
  });

  it("moves a task forward; sending RESOLVED is 422", async () => {
    const api = await as("u1");
    const t = await unwrap(
      api.PATCH("/v1/tasks/{task_id}", { ...T(119), body: { status: "IN_PROGRESS" } }),
    );
    expect(t.status).toBe("IN_PROGRESS");
    await expect(
      api.PATCH("/v1/tasks/{task_id}", { ...T(119), body: { status: "RESOLVED" as never } }),
    ).rejects.toMatchObject({ code: "TASK_STATUS_NOT_ALLOWED", status: 422 });
  });

  it("cancels an open task (204); readonly cannot (403)", async () => {
    await expect((await as("u5")).DELETE("/v1/tasks/{task_id}", T(123))).rejects.toMatchObject({
      status: 403,
    });
    const { response } = await (await as("u1")).DELETE("/v1/tasks/{task_id}", T(123));
    expect(response.status).toBe(204);
    expect(mock.db.tasks.some((t) => t.number === "T-123")).toBe(false);
  });
});
