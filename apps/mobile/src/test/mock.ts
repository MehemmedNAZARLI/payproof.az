import { createApiClient } from "@payproof/api-client";
import { createDemoDb, mockIds, tokenFor } from "@payproof/mocks";

import { api, unwrap } from "@/lib/api";
import { createMockFetch, mockApi } from "@/lib/api/mock/mock-fetch";
import { startSession } from "@/lib/session";

// Tests run against the same @payproof/mocks demo company as `pnpm dev` (no latency under Vitest).
// vitest.setup.ts resets it after every test.

/** Fixture user slugs: u1 Aygün (operator), u2 Rəşad (approver), u5 Kamran (readonly). */
export type DemoUser = "u1" | "u2" | "u5";

/** The mock's bearer token for a fixture user. */
export const mockToken = (slug: string) => tokenFor(mockIds.user(slug));

/** A client of its own, signed in as `slug` (null: signed out), independent of the app session. */
export const mockClient = (slug: string | null = "u2") =>
  createApiClient({
    baseUrl: "http://localhost:8000",
    getToken: () => (slug ? mockToken(slug) : null),
    fetch: createMockFetch(),
  });

/** Signs the app in as a demo user through the mock's dev-login. */
export async function signInAs(slug: DemoUser) {
  const session = await unwrap(
    api.POST("/v1/auth/dev-login", { body: { user_id: mockIds.user(slug) } }),
  );
  startSession(session);
  return session;
}

/** Package UUID by fixture slug (`pkg_1042`). */
export const pkgId = (slug: string) => mockIds.pkg(slug);

const login = (slug: DemoUser) =>
  unwrap(mockClient(null).POST("/v1/auth/dev-login", { body: { user_id: mockIds.user(slug) } }));
const issued = { u1: await login("u1"), u2: await login("u2"), u5: await login("u5") };

/** The `Me` the mock's dev-login returns for a demo user. */
export function meFor(slug: string) {
  const session = issued[slug as DemoUser] as (typeof issued)[DemoUser] | undefined;
  if (!session) throw new Error(`no demo user ${slug}`);
  return session.user;
}

/** The mock's notification page for a demo user, as the server holds it now. */
export const notificationsOf = (slug: DemoUser = "u2") =>
  unwrap(mockClient(slug).GET("/v1/notifications", { params: { query: { limit: 100 } } }));

/** The mock's package detail (by UUID) as a demo user sees it now. */
export const detailOf = (packageId: string, slug: DemoUser = "u2") =>
  unwrap(
    mockClient(slug).GET("/v1/packages/{package_id}", {
      params: { path: { package_id: packageId } },
    }),
  );

const seeded = createDemoDb().audit.length;

/** Approvals recorded since the fixtures (the mock's audit trail), to tell one approval from two. */
export const recordedApprovals = () =>
  mockApi()
    .db.audit.slice(seeded)
    .filter((a) => a.action === "approval.created");
