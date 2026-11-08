import { http, HttpResponse } from "msw";

import type { Schemas } from "../client";
import { auditLog } from "./audit";
import { dashboard } from "./dashboard";
import { listPackages, QueryError } from "./list-packages";
import { devUsers, meFor, packageList, userSlug } from "./store";

// Tokens are `mock.<fixture user slug>`; the real API issues a JWT for the same users.
const TOKEN = /^Bearer mock\.(\w+)$/;

export const mockToken = (userSlug: string) => `mock.${userSlug}`;

export function apiError(
  status: number,
  code: Schemas["ErrorCode"],
  message: string,
  details = {},
) {
  return HttpResponse.json({ error: { code, message, details } } satisfies Schemas["Error"], {
    status,
  });
}

function sessionUser(request: Request): Schemas["Me"] | undefined {
  const slug = TOKEN.exec(request.headers.get("Authorization") ?? "")?.[1];
  return slug ? meFor(slug) : undefined;
}

const unauthenticated = () =>
  apiError(401, "UNAUTHENTICATED", "Sessiya bitib. Yenidən daxil olun.");

// The contract's dev JWT lifetime (8 hours).
const SESSION_SECONDS = 28_800;

async function readUserId(request: Request): Promise<string | undefined> {
  try {
    const body: unknown = await request.json();
    if (typeof body === "object" && body !== null && "user_id" in body)
      return typeof body.user_id === "string" ? body.user_id : undefined;
  } catch {
    // not JSON — a validation error below
  }
  return undefined;
}

export const handlers = [
  http.get("*/v1/auth/dev-users", () => HttpResponse.json({ items: devUsers })),
  http.post("*/v1/auth/dev-login", async ({ request }) => {
    const id = await readUserId(request);
    if (id === undefined)
      return apiError(422, "VALIDATION_ERROR", "user_id tələb olunur.", { field: "user_id" });
    const slug = userSlug(id);
    const user = slug && meFor(slug);
    if (!slug || !user) return apiError(404, "NOT_FOUND", "Demo istifadəçi tapılmadı.");
    return HttpResponse.json({
      access_token: mockToken(slug),
      token_type: "bearer",
      expires_in: SESSION_SECONDS,
      user,
    } satisfies Schemas["Session"]);
  }),
  http.get("*/v1/me", ({ request }) => {
    const me = sessionUser(request);
    return me ? HttpResponse.json(me satisfies Schemas["Me"]) : unauthenticated();
  }),
  http.get("*/v1/dashboard", ({ request }) =>
    sessionUser(request) ? HttpResponse.json(dashboard()) : unauthenticated(),
  ),
  http.get("*/v1/audit", ({ request }) => {
    if (!sessionUser(request)) return unauthenticated();
    const params = new URL(request.url).searchParams;
    // shortcut: search, actor, period, CSV and paging arrive with S-06; refused loudly until then.
    const unsupported = ["q", "actor_id", "from", "to", "format", "cursor"].find((n) =>
      params.has(n),
    );
    const limit = Number(params.get("limit") ?? 50);
    if (unsupported || !Number.isInteger(limit) || limit < 1 || limit > 200)
      return apiError(422, "VALIDATION_ERROR", "Sorğu parametri yanlışdır.", {
        param: unsupported ?? "limit",
      });
    const packageId = params.get("package_id");
    const items = auditLog.filter((e) => !packageId || e.package?.id === packageId);
    return HttpResponse.json({
      items: items.slice(0, limit),
      next_cursor: null,
    } satisfies Schemas["AuditPage"]);
  }),
  http.get("*/v1/packages", ({ request }) => {
    if (!sessionUser(request)) return unauthenticated();
    try {
      return HttpResponse.json(listPackages(packageList, new URL(request.url).searchParams));
    } catch (error) {
      if (!(error instanceof QueryError)) throw error;
      return apiError(422, "VALIDATION_ERROR", "Sorğu parametri yanlışdır.", {
        param: error.param,
      });
    }
  }),
];
