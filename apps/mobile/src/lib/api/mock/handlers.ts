import packages from "@fixtures/packages.json";
import { http, HttpResponse } from "msw";

import type { Schemas } from "../client";
import { MOCK_FILE_SCHEME } from "../mock-file";
import { approve } from "./approve";
import { liveAuditLog } from "./audit";
import { dashboard } from "./dashboard";
import { findVersion } from "./documents";
import { listPackages, QueryError } from "./list-packages";
import { livePackages } from "./live";
import { packageDetail } from "./package-detail";
import { devUsers, meFor, userSlug } from "./store";

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

/** The fixture slug of a signed-in user (`u2`), if the token belongs to one. */
function sessionSlug(request: Request): string | undefined {
  const slug = TOKEN.exec(request.headers.get("Authorization") ?? "")?.[1];
  return slug && meFor(slug) ? slug : undefined;
}

function sessionUser(request: Request): Schemas["Me"] | undefined {
  const slug = sessionSlug(request);
  return slug ? meFor(slug) : undefined;
}

const notFound = () => apiError(404, "NOT_FOUND", "Obyekt tapılmadı.");

const LINK_SECONDS = 300;

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
    const items = liveAuditLog().filter((e) => !packageId || e.package?.id === packageId);
    return HttpResponse.json({
      items: items.slice(0, limit),
      next_cursor: null,
    } satisfies Schemas["AuditPage"]);
  }),
  http.get("*/v1/packages", ({ request }) => {
    if (!sessionUser(request)) return unauthenticated();
    try {
      return HttpResponse.json(listPackages(livePackages(), new URL(request.url).searchParams));
    } catch (error) {
      if (!(error instanceof QueryError)) throw error;
      return apiError(422, "VALIDATION_ERROR", "Sorğu parametri yanlışdır.", {
        param: error.param,
      });
    }
  }),
  http.get("*/v1/packages/:id", ({ request, params }) => {
    const slug = sessionSlug(request);
    if (!slug) return unauthenticated();
    const detail = packageDetail(String(params.id), slug);
    return detail ? HttpResponse.json(detail) : notFound();
  }),
  http.post("*/v1/packages/:id/approve", async ({ request, params }) => {
    const slug = sessionSlug(request);
    if (!slug) return unauthenticated();
    const body: unknown = await request.json().catch(() => undefined);
    const key = request.headers.get("Idempotency-Key");
    const result = approve({ userSlug: slug, packageId: String(params.id), key, body });
    return result.status === 200
      ? HttpResponse.json(result.approval)
      : apiError(result.status, result.error.code, result.error.message, result.error.details);
  }),
  http.get("*/v1/documents/versions/:id/file", ({ request, params }) => {
    if (!sessionUser(request)) return unauthenticated();
    const id = String(params.id);
    if (!findVersion(packages, id)) return notFound();
    return HttpResponse.json({
      url: `${MOCK_FILE_SCHEME}${id}`,
      expires_at: new Date(Date.now() + LINK_SECONDS * 1000)
        .toISOString()
        .replace(/\.\d{3}Z$/, "Z"),
    } satisfies Schemas["SignedUrl"]);
  }),
];
