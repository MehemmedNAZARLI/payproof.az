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

  it("legacy flags are expressed as documents and R-rule checks (ADR-0011)", () => {
    const rs = v.customer(db, db.customer("c1")).current_requirements;
    expect(rs.documents).toEqual([
      { type: "invoice", name: "Faktura", min_count: 1, max_count: 1 },
      { type: "order", name: "Sifariş", min_count: 0, max_count: 1 },
      { type: "delivery", name: "Təhvil-təslim aktı", min_count: 1, max_count: 1 },
    ]);
    expect(rs.checks?.map((c) => c.id)).toEqual([
      "R-001", "R-002", "R-003", "R-004", "R-005", "R-006", "R-007", "R-008", "R-009",
    ]); // prettier-ignore
    expect(rs.checks?.[0]).toEqual({
      id: "R-001",
      type: "legacy_rule",
      title: "Məcburi sifariş nömrəsi (PO)",
      parameters: {},
    });
    expect(rs.output).toBeNull();
    const noDelivery = { ...db.customer("c1").requirement_sets[0]!, require_delivery: false };
    expect(v.requirementSet(db, db.customer("c1"), noDelivery).documents?.[2]?.min_count).toBe(0);
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
