import { http, HttpResponse } from "msw";

import type { Schemas } from "../client";
import { listPackages, QueryError } from "./list-packages";
import { meFor, packageList } from "./store";

// shortcut: until dev-login (M-04), a request without a token is served as the default
// demo account — Rəşad, the approver. Tokens are `mock.<fixture user slug>`.
const DEFAULT_USER = "u2";
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
  const header = request.headers.get("Authorization");
  if (header === null) return meFor(DEFAULT_USER);
  const slug = TOKEN.exec(header)?.[1];
  return slug ? meFor(slug) : undefined;
}

const unauthenticated = () =>
  apiError(401, "UNAUTHENTICATED", "Sessiya bitib. Yenidən daxil olun.");

export const handlers = [
  http.get("*/v1/me", ({ request }) => {
    const me = sessionUser(request);
    return me ? HttpResponse.json(me satisfies Schemas["Me"]) : unauthenticated();
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
