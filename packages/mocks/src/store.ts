// In-memory mock database built from fixtures/*.json. Every createMockDb() is an independent deep copy.
import customers from "../../../fixtures/customers.json";
import expected from "../../../fixtures/expected.json";
import newsets from "../../../fixtures/newsets.json";
import notifications from "../../../fixtures/notifications.json";
import orders from "../../../fixtures/orders.json";
import packages from "../../../fixtures/packages.json";
import samples from "../../../fixtures/samples.json";
import tasks from "../../../fixtures/tasks.json";
import users from "../../../fixtures/users.json";
import type * as T from "./types";

/** Fixture wall-clock (+04:00) → contract UTC (`…Z`, no milliseconds). */
export const utc = (s: string) => new Date(s).toISOString().replace(".000Z", "Z");

export interface MockDbOptions {
  /** How long a job stays RUNNING (ms). Browser ~800, tests 0. */
  jobDelayMs?: number;
}

export interface Job {
  id: string;
  kind: "extract_document" | "create_package";
  created_at: string;
  ready_at_ms: number;
  /** null when the job failed before a package existed (e.g. DUPLICATE_INVOICE). */
  package_id: string | null;
  document_version_id?: string | undefined;
  error?: { code: string; message: string } | undefined;
  done: boolean;
}

export class MockDb {
  readonly users: T.User[] = structuredClone(users) as T.User[];
  readonly customers: T.Customer[] = structuredClone(customers) as T.Customer[];
  readonly orders: Record<string, T.Order> = Object.fromEntries(
    (structuredClone(orders) as T.Order[]).map((o) => [o.po_number, o]),
  );
  packages: T.Pkg[];
  tasks: T.Task[];
  notifications: T.Notification[];
  readonly audit: T.AuditEvent[] = [];
  readonly samples: T.Sample[] = structuredClone(samples) as T.Sample[];
  readonly newsets = structuredClone(newsets);
  readonly jobs = new Map<string, Job>();
  readonly idempotency = new Map<
    string,
    { fingerprint: string; status: number; body: unknown; pending?: boolean }
  >();
  readonly seq = { audit: 0, notification: 0, job: 0, task: 0 };
  readonly jobDelayMs: number;
  private clockMs = Date.parse(expected.demo_now);

  constructor(options: MockDbOptions = {}) {
    this.jobDelayMs = options.jobDelayMs ?? 0;
    this.packages = (structuredClone(packages) as unknown as T.Pkg[]).map((p) => ({
      ...p,
      created_at: utc(p.created_at),
      updated_at: utc(p.created_at),
      problem_since: null,
      last_status: null,
      documents: p.documents.map((d) => ({
        ...d,
        versions: d.versions.map((v) => ({
          ...v,
          uploaded_at: utc(v.uploaded_at),
          // fixtures: every new document version bumped the package version once
          package_version_at_upload: v.version_no,
        })),
      })),
      approvals: p.approvals.map((a) => ({
        ...a,
        created_at: utc(a.created_at),
        invalidated_at: a.invalidated_at && utc(a.invalidated_at),
      })),
      exports: p.exports.map((e) => ({ ...e, created_at: utc(e.created_at) })),
    }));
    this.tasks = (structuredClone(tasks) as T.Task[]).map((t) => ({
      ...t,
      created_at: utc(t.created_at),
      resolved_at: t.resolved_at && utc(t.resolved_at),
    }));
    this.seq.task = Math.max(...this.tasks.map((t) => Number(t.number.slice(2))), 123);
    this.notifications = notifications.map((n) => ({
      ...n,
      seq: ++this.seq.notification,
      created_at: utc(n.created_at),
    }));
  }

  nowIso(): string {
    return utc(new Date(this.clockMs).toISOString());
  }
  /** Advance the demo clock by 2 minutes (one user action) and return the new time. */
  tick(): string {
    this.clockMs += 2 * 60_000;
    return this.nowIso();
  }
  pkg(slug: string): T.Pkg {
    const p = this.packages.find((x) => x.id === slug);
    if (!p) throw new Error(`unknown package ${slug}`);
    return p;
  }
  user(slug: string): T.User | undefined {
    return this.users.find((u) => u.id === slug);
  }
  customer(slug: string): T.Customer {
    const c = this.customers.find((x) => x.id === slug);
    if (!c) throw new Error(`unknown customer ${slug}`);
    return c;
  }
}

export const createMockDb = (options?: MockDbOptions) => new MockDb(options);
