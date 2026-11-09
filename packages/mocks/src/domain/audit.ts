// Append-only audit log and in-app notifications. Messages are Azerbaijani (prototype wording), no document text.
import type { MockDb } from "../store";

export class MockError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export interface LogInput {
  actor: string | null;
  action: string;
  message: string;
  pkg?: string | null;
  objectType?: string;
  objectId?: string | null;
  details?: Record<string, unknown>;
  at?: string;
}

export function log(db: MockDb, e: LogInput) {
  const p = e.pkg ? db.packages.find((x) => x.id === e.pkg) : undefined;
  db.audit.push({
    seq: ++db.seq.audit,
    created_at: e.at ?? db.tick(),
    actor_id: e.actor === "system" ? null : e.actor,
    action: e.action,
    message: e.message,
    package_id: e.pkg ?? null,
    invoice_number: p?.invoice_number ?? null,
    package_version: p?.version ?? null,
    object_type: e.objectType ?? "package",
    object_id: e.objectId ?? null,
    details: e.details ?? {},
  });
}

export function notify(db: MockDb, to: string, pkg: string | null, text: string) {
  db.notifications.push({
    seq: ++db.seq.notification,
    user_id: to,
    package_id: pkg,
    text,
    created_at: db.nowIso(),
    read: false,
  });
}

export const approvers = (db: MockDb) =>
  db.users.filter((u) => u.role === "approver").map((u) => u.id);
