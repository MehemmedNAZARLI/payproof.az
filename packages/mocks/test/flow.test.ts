import { describe, expect, it } from "vitest";
import expected from "../../../fixtures/expected.json";
import { approvePackage, exportPackage } from "../src/domain/approval";
import { confirmLink, reviewSignature } from "../src/domain/review";
import { createTask } from "../src/domain/tasks";
import { uploadDocument } from "../src/domain/upload";
import { info } from "../src/engine/status";
import { createMockDb } from "../src/store";

// INV-1042 main demo flow at domain level, step by step against fixtures/expected.json → flows.
describe("INV-1042 flow (domain) = expected.flows", () => {
  it("matches every step", async () => {
    const db = createMockDb();
    const p = db.pkg("pkg_1042");
    const steps = new Map(expected.flows["INV-1042"].map((s) => [s.step, s]));
    const check = (step: string) => {
      const want = steps.get(step)!;
      const i = info(db, p);
      expect({
        step,
        status: i.status,
        version: p.version,
        blockers: i.primary.map((c) => ({ rule_id: c.rule_id, outcome: c.outcome })),
      }).toEqual({ step, status: want.status, version: want.version, blockers: want.blockers });
    };
    const tasks = () =>
      db.tasks
        .filter((t) => t.package_id === p.id)
        .map((t) => ({ rule_id: t.rule_id, assignee_id: t.assignee_id, status: t.status }));

    check("initial");
    expect(() => approvePackage(db, p, "u2")).toThrow(
      expect.objectContaining({ code: "PACKAGE_NOT_READY" }),
    );
    check("approve_blocked");
    confirmLink(db, p, "PO-381", "u1");
    check("confirm_link");
    createTask(
      db,
      p,
      { rule_id: "R-001", assignee_id: "u6", step: "PO əlavə edin", due_date: "2026-11-09" },
      "u1",
    );
    createTask(
      db,
      p,
      { rule_id: "R-007", assignee_id: "u3", step: "Aktı yükləyin", due_date: "2026-11-09" },
      "u1",
    );
    check("create_tasks");
    await uploadDocument(db, p, "invoice", "INV-1042_v2_PO-381.pdf", "u1");
    check("upload_invoice");
    await expect(uploadDocument(db, p, "invoice", "INV-1042.pdf", "u1")).rejects.toMatchObject({
      code: "DUPLICATE_FILE",
    });
    check("upload_duplicate");
    await uploadDocument(db, p, "delivery", "TS-5531_imzali.pdf", "u1");
    check("upload_delivery");
    reviewSignature(db, p, "u1");
    check("review_signature");
    const want = steps.get("review_signature")!.tasks!;
    expect(tasks().sort((a, b) => a.rule_id.localeCompare(b.rule_id))).toEqual(
      want
        .map(({ rule_id, assignee_id, status }) => ({ rule_id, assignee_id, status }))
        .sort((a, b) => a.rule_id.localeCompare(b.rule_id)),
    );
    const first = approvePackage(db, p, "u2");
    expect(first.created).toBe(true);
    check("approve");
    const again = approvePackage(db, p, "u2");
    expect(again).toEqual({ approval: first.approval, created: false });
    expect(p.approvals).toHaveLength(steps.get("approve_repeat")!.approvals!);
    const files = steps
      .get("export")!
      .files!.map((file_name, i) => ({ type: ["invoice", "order", "delivery"][i]!, file_name }));
    expect(exportPackage(db, p, "u1", files).created).toBe(true);
    check("export");
    const audits = db.audit.length;
    expect(exportPackage(db, p, "u1", files).created).toBe(false);
    expect(p.exports).toHaveLength(steps.get("export_repeat")!.exports!);
    expect(db.audit.length).toBe(audits);
  });
});
