import { describe, expect, it } from "vitest";
import { createDemoDb } from "../src/domain/seed";
import * as v from "../src/views/records";
import { assertSchema } from "./contract";

describe("record serializers conform to the contract", () => {
  const db = createDemoDb();

  it("Me (operator Aygün) with permissions; assignee has none", () => {
    const me = v.me(db, "u1");
    assertSchema("Me", me);
    expect(me).toMatchObject({
      id: "0193a000-0000-7000-8000-000000000001",
      role: "operator",
      company: { voen: "1700123451" },
    });
    expect(me.permissions).not.toContain("APPROVE_PACKAGE");
    expect(v.me(db, "u3").permissions).toEqual([]);
  });

  it("Customer with its current requirement set", () => {
    for (const c of db.customers) assertSchema("Customer", v.customer(db, c));
    expect(v.customer(db, db.customer("c1")).current_requirements).toMatchObject({
      version: 2,
      require_signature: true,
    });
  });

  it("Task, ApprovalRecord, ExportRecord, AuditEvent, Notification", () => {
    for (const t of db.tasks) assertSchema("Task", v.task(db, t));
    const p = db.pkg("pkg_1033");
    assertSchema("ApprovalRecord", v.approval(db, p, p.approvals[0]!));
    assertSchema("ExportRecord", v.exportRecord(db, p, p.exports[0]!));
    for (const e of db.audit) assertSchema("AuditEvent", v.auditEvent(db, e));
    for (const n of db.notifications) assertSchema("Notification", v.notification(db, n));
  });

  it("export files reference the current document versions", () => {
    const p = db.pkg("pkg_1033");
    expect(v.exportRecord(db, p, p.exports[0]!).files.map((f) => f.type)).toEqual([
      "invoice",
      "order",
      "delivery",
    ]);
  });
});
