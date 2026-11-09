// Live events (ADR-0010): IDs only, derived from the audit rows and notifications a successful request added.
import type { Schemas } from "@payproof/api-client";
import { id } from "./ids";
import type { MockDb } from "./store";

export type LiveEventType = Schemas["LiveEventType"];
export type LiveEvent = Schemas["LiveEvent"];

const EXACT: Record<string, LiveEventType> = {
  "package.created": "package.created",
  "package.deleted": "package.deleted",
  "approval.created": "package.approved",
  "export.created": "package.exported",
  "requirements.updated": "requirements.changed",
};

/** Audit action → event type; every other package-level action (document, field, link, …) is an update. */
export const eventType = (action: string): LiveEventType =>
  EXACT[action] ?? (action.startsWith("task.") ? "task.changed" : "package.updated");

/** Position in the store before a request, so only what that request added becomes an event. */
export const mark = (db: MockDb) => ({
  audit: db.audit.length,
  notifications: db.notifications.length,
});

export function newEvents(db: MockDb, from: ReturnType<typeof mark>): LiveEvent[] {
  const version = (slug: string | null) =>
    slug ? (db.packages.find((p) => p.id === slug)?.version ?? null) : null;
  const base = (slug: string | null) => ({
    company_id: id.company(),
    package_id: slug && id.pkg(slug),
    package_version: version(slug),
  });
  return [
    ...db.audit.slice(from.audit).map((a) => ({
      event_id: id.audit(a.seq),
      type: eventType(a.action),
      ...base(a.package_id),
      actor_id: a.actor_id && id.user(a.actor_id),
      at: a.created_at,
    })),
    ...db.notifications.slice(from.notifications).map((n) => ({
      event_id: id.notification(n.seq),
      type: "notification.created" as const,
      ...base(n.package_id),
      actor_id: null,
      at: n.created_at,
    })),
  ];
}

export class EventBus {
  private readonly listeners = new Set<(e: LiveEvent) => void>();
  subscribe(fn: (e: LiveEvent) => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }
  /** A failing listener (closed stream, channel) must not turn an applied write into a 500. */
  emit(e: LiveEvent) {
    for (const fn of this.listeners) {
      try {
        fn(e);
      } catch (error) {
        console.error("[mocks] live event listener failed", error);
      }
    }
  }
}
