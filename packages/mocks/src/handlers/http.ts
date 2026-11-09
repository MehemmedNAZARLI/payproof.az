// HTTP plumbing shared by all handlers: auth, contract errors, version/permission checks, idempotency, paging.
import { delay, HttpResponse } from "msw";
import { MockError } from "../domain/audit";
import { type EventBus, mark, newEvents } from "../events";
import { slugOf } from "../ids";
import { can, type Permission } from "../permissions";
import type { MockDb } from "../store";
import type { Pkg, User } from "../types";

export interface Ctx {
  db: () => MockDb;
  events: EventBus;
  latencyMs: number;
  /** Replace the store with a fresh fixtures copy (POST /v1/demo/reset). */
  reset: () => void;
}

export const json = (body: unknown, status = 200) => HttpResponse.json(body as never, { status });
const errorBody = (e: MockError) => ({
  error: { code: e.code, message: e.message, details: e.details },
});

/** Token issued by dev-login. Not a JWT — the mock only needs to know who is calling. */
export const tokenFor = (userUuid: string) => `mock.${userUuid}`;

export function currentUser(db: MockDb, request: Request): User {
  const token = request.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
  const slug = token.startsWith("mock.") ? slugOf.user(token.slice(5)) : null;
  const user = slug ? db.user(slug) : undefined;
  if (!user || user.role === "assignee")
    throw new MockError("UNAUTHENTICATED", "Sessiya bitib. Yenidən daxil olun.", 401);
  return user;
}

const FORBIDDEN: Partial<Record<Permission, string>> = {
  APPROVE_PACKAGE: "Hazır paketi yalnız təsdiqçi rolu təsdiqləyə bilər.",
  MANAGE_REQUIREMENTS: "Müştəri qaydasını yalnız təsdiqçi rolu təsdiqləyə bilər.",
};
export function requirePermission(user: User, perm: Permission) {
  if (!can(user, perm))
    throw new MockError(
      "FORBIDDEN",
      FORBIDDEN[perm] ?? "Bu əməliyyat üçün səlahiyyətiniz yoxdur.",
      403,
    );
}

export const notFound = () => new MockError("NOT_FOUND", "Obyekt tapılmadı.", 404);

// shortcut: demo files have no bytes — the "signed" link points at a placeholder (`*/mock-files/*`); real storage in B-13.
export const signedLink = (db: MockDb, request: Request, path: string) => ({
  url: `${new URL(request.url).origin}/mock-files/${path}`,
  expires_at: new Date(Date.parse(db.nowIso()) + 5 * 60_000).toISOString().replace(".000Z", "Z"),
});

export function packageOf(db: MockDb, uuid: string | readonly string[] | undefined): Pkg {
  const slug = typeof uuid === "string" ? slugOf.pkg(uuid) : null;
  const p = slug ? db.packages.find((x) => x.id === slug && !x.deleted) : undefined;
  if (!p) throw notFound();
  return p;
}

/** Edits wait until extraction is done (`permissions.can_edit` is false meanwhile — enforced here too). */
export function requireEditable(p: Pkg) {
  if (p.processing)
    throw new MockError(
      "PACKAGE_NOT_READY",
      "Paket hələ emal olunur — bir az sonra yenidən cəhd edin.",
      409,
      {
        status: "PROCESSING",
      },
    );
}

/** Multipart/query value → number, or undefined when missing (so expectVersion answers 422, not 409). */
export const versionParam = (raw: FormDataEntryValue | string | null) =>
  raw === null || raw === "" ? undefined : Number(raw);

export function expectVersion(p: Pkg, expected: unknown) {
  if (typeof expected !== "number" || !Number.isInteger(expected))
    throw new MockError("VALIDATION_ERROR", "expected_version məcburidir.", 422, {
      fields: { expected_version: "Məcburi sahə." },
    });
  if (expected !== p.version)
    throw new MockError(
      "VERSION_CONFLICT",
      `Paket v${p.version}-ə yenilənib; səhifəni yeniləyin.`,
      409,
      {
        current_version: p.version,
        expected_version: expected,
      },
    );
}

/** JSON body as an object; malformed JSON → 400 (contract BadRequest). */
export async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json();
    if (value && typeof value === "object" && !Array.isArray(value))
      return value as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new MockError("VALIDATION_ERROR", "Sorğunun formatı yanlışdır.", 400);
}

export const required = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !value.trim())
    throw new MockError("VALIDATION_ERROR", "Sorğuda xəta var.", 422, {
      fields: { [field]: "Məcburi sahə." },
    });
  return value;
};

/**
 * Same key + same body → the stored response (no new event); same key + other body → 422.
 * `fingerprint` must describe the intent (endpoint + body), not the attempt.
 */
export async function idempotent(
  db: MockDb,
  request: Request,
  fingerprint: string,
  run: () => Promise<Response>,
) {
  const key = request.headers.get("Idempotency-Key");
  if (!key) throw new MockError("VALIDATION_ERROR", "Idempotency-Key başlığı məcburidir.", 422);
  const seen = db.idempotency.get(key);
  if (seen) {
    if (seen.fingerprint !== fingerprint)
      throw new MockError(
        "IDEMPOTENCY_KEY_REUSED",
        "Eyni sorğu fərqli məlumatla təkrarlandı.",
        422,
      );
    if (seen.pending)
      throw new MockError("IDEMPOTENCY_IN_PROGRESS", "Eyni sorğu hələ emal olunur.", 409);
    return json(seen.body, seen.status);
  }
  // claim the key before running, so a concurrent duplicate cannot run the action twice
  db.idempotency.set(key, { fingerprint, status: 0, body: null, pending: true });
  try {
    const res = await run();
    db.idempotency.set(key, { fingerprint, status: res.status, body: await res.clone().json() });
    return res;
  } catch (e) {
    db.idempotency.delete(key); // nothing happened — the client may retry with the same key
    throw e;
  }
}

const encode = (n: number) => btoa(String(n));
export function page<T>(items: T[], url: URL) {
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50));
  const start = Number(atob(url.searchParams.get("cursor") ?? "") || 0) || 0;
  const end = start + limit;
  return { items: items.slice(start, end), next_cursor: end < items.length ? encode(end) : null };
}

/** Wraps a resolver: latency, MockError → contract error, anything else → 500 INTERNAL_ERROR. */
export interface Args {
  request: Request;
  params: Record<string, string | readonly string[] | undefined>;
}

export const route =
  <A extends Args>(ctx: Ctx, fn: (args: A, db: MockDb) => Promise<Response> | Response) =>
  async (args: A) => {
    if (ctx.latencyMs) await delay(ctx.latencyMs);
    const db = ctx.db();
    const before = mark(db);
    try {
      const res = await fn(args, db);
      // like the server's NOTIFY-on-commit: only a successful request publishes what it changed
      if (res.ok) for (const e of newEvents(db, before)) ctx.events.emit(e);
      return res;
    } catch (e) {
      if (e instanceof MockError) return json(errorBody(e), e.status);
      console.error("[mocks]", e);
      return json(
        errorBody(new MockError("INTERNAL_ERROR", "Gözlənilməz xəta baş verdi.", 500)),
        500,
      );
    }
  };
