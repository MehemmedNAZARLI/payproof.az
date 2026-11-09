import { describe, expect, it } from "vitest";
import { bump, validate } from "../src/domain/validate";
import { info } from "../src/engine/status";
import { createMockDb } from "../src/store";

describe("version bump and re-validation", () => {
  it("a new version invalidates the current approval, keeps it in audit and notifies the approver", () => {
    const db = createMockDb();
    const p = db.pkg("pkg_1035");
    expect(info(db, p).status).toBe("APPROVED_READY");
    bump(db, p, "təhvil sənədinin yeni versiyası yükləndi");
    expect(p.version).toBe(2);
    expect(p.approvals[0]).toMatchObject({
      valid: false,
      invalidated_reason: "təhvil sənədinin yeni versiyası yükləndi",
    });
    expect(db.audit.at(-1)).toMatchObject({
      action: "approval.invalidated",
      actor_id: null,
      package_id: "pkg_1035",
    });
    expect(db.notifications.at(-1)).toMatchObject({
      user_id: "u2",
      package_id: "pkg_1035",
      read: false,
    });
    expect(info(db, p).status).toBe("READY_FOR_APPROVAL");
  });

  it("validate resolves a task as system when its rule passes", () => {
    const db = createMockDb();
    const p = db.pkg("pkg_1047");
    p.invoice.po_ref = "PO-397";
    p.invoice.unreadable_fields = [];
    validate(db, p);
    expect(db.tasks.find((t) => t.number === "T-121")).toMatchObject({ status: "RESOLVED" });
    expect(db.audit.at(-1)).toMatchObject({ action: "task.resolved", actor_id: null });
  });

  it("validate returns a SUBMITTED_FOR_RECHECK task to IN_PROGRESS when the rule still fails", () => {
    const db = createMockDb();
    const t = db.tasks.find((x) => x.number === "T-118")!;
    t.status = "SUBMITTED_FOR_RECHECK";
    validate(db, db.pkg("pkg_1044"));
    expect(t.status).toBe("IN_PROGRESS");
  });

  it("notifies approvers when a package becomes READY_FOR_APPROVAL and tracks the problem age", () => {
    const db = createMockDb();
    const p = db.pkg("pkg_1043");
    validate(db, p);
    expect(p.problem_since).toBe(db.nowIso());
    p.invoice.po_ref = "PO-382";
    const before = db.notifications.length;
    validate(db, p);
    expect(p.problem_since).toBeNull();
    expect(db.notifications.slice(before)).toEqual([
      expect.objectContaining({
        user_id: "u2",
        text: "INV-1043 təsdiqinizi gözləyir · 1.920,00 AZN",
      }),
    ]);
  });
});
