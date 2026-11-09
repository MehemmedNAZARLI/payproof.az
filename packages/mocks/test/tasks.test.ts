import { describe, expect, it } from "vitest";
import { cancelTask, createTask, updateTask } from "../src/domain/tasks";
import { createMockDb } from "../src/store";

const task = (db: ReturnType<typeof createMockDb>, n: string) =>
  db.tasks.find((t) => t.number === n)!;

describe("resolution tasks", () => {
  it("creates numbered tasks; assignees (ADR-0008) get no in-app notification", () => {
    const db = createMockDb();
    const before = db.notifications.length;
    const t = createTask(
      db,
      db.pkg("pkg_1042"),
      { rule_id: "R-001", assignee_id: "u6", step: "PO əlavə edin", due_date: "2026-11-09" },
      "u1",
    );
    expect(t).toMatchObject({
      number: "T-124",
      status: "OPEN",
      created_by: "u1",
      resolved_at: null,
    });
    expect(db.notifications.length).toBe(before);
    createTask(
      db,
      db.pkg("pkg_1042"),
      { rule_id: "R-007", assignee_id: "u2", step: "Aktı yükləyin", due_date: "2026-11-09" },
      "u1",
    );
    expect(db.notifications.at(-1)).toMatchObject({ user_id: "u2" });
  });

  it("rejects a second open task for the same rule", () => {
    const db = createMockDb();
    expect(() =>
      createTask(
        db,
        db.pkg("pkg_1043"),
        { rule_id: "R-002", assignee_id: "u6", step: "x x x", due_date: "2026-11-09" },
        "u1",
      ),
    ).toThrow(expect.objectContaining({ code: "TASK_ALREADY_OPEN", status: 409 }));
  });

  it("moves OPEN → IN_PROGRESS → SUBMITTED_FOR_RECHECK; the system re-checks immediately", () => {
    const db = createMockDb();
    const t = task(db, "T-119");
    updateTask(db, t, { status: "IN_PROGRESS" }, "u1");
    expect(t.status).toBe("IN_PROGRESS");
    updateTask(db, t, { status: "SUBMITTED_FOR_RECHECK" }, "u1");
    // R-002 still fails for INV-1043, so the system sends it back
    expect(t.status).toBe("IN_PROGRESS");
  });

  it.each([
    ["T-119", "RESOLVED"],
    ["T-119", "SUBMITTED_FOR_RECHECK"],
    ["T-112", "IN_PROGRESS"],
  ])("%s → %s is not allowed (422)", (n, status) => {
    const db = createMockDb();
    expect(() => updateTask(db, task(db, n), { status: status as never }, "u1")).toThrow(
      expect.objectContaining({ code: "TASK_STATUS_NOT_ALLOWED", status: 422 }),
    );
  });

  it("a rejected transition changes nothing else", () => {
    const db = createMockDb();
    const t = task(db, "T-119");
    expect(() =>
      updateTask(db, t, { status: "SUBMITTED_FOR_RECHECK", due_date: "2030-01-01" }, "u1"),
    ).toThrow();
    expect(t.due_date).toBe("2026-11-09");
  });

  it("cancels an open task (audited) but not a resolved one", () => {
    const db = createMockDb();
    cancelTask(db, task(db, "T-123"), "u1");
    expect(db.tasks.some((t) => t.number === "T-123")).toBe(false);
    expect(db.audit.at(-1)).toMatchObject({ action: "task.cancelled", actor_id: "u1" });
    expect(() => cancelTask(db, task(db, "T-112"), "u1")).toThrow(
      expect.objectContaining({ code: "TASK_STATUS_NOT_ALLOWED" }),
    );
  });
});
