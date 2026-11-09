import { execFileSync } from "node:child_process";
import { expect, test as base, type APIRequestContext, type Page } from "@playwright/test";
import { API_ENV, API_URL, REAL } from "./stack";

// Expected API refusals (409 duplicate, 403 role, …) are part of the flows under test; Chrome logs
// each such response. Anything else in the console — or an uncaught error — fails the test.
const EXPECTED = /Failed to load resource: the server responded with a status of 4\d\d/;

export const test = base.extend<{ consoleGuard: void; freshData: void }>({
  // mock data starts fresh on every full load; the real database is reseeded before each test
  freshData: [
    async ({}, use) => {
      if (REAL)
        execFileSync("uv", ["run", "payproof-seed", "--reset"], {
          cwd: "../api",
          env: { ...process.env, ...API_ENV },
          stdio: "ignore",
        });
      await use();
    },
    { auto: true },
  ],
  consoleGuard: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error" && !EXPECTED.test(m.text())) errors.push(m.text());
      });
      page.on("pageerror", (e) => errors.push(e.message));
      await use();
      expect(errors, "no console errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect, REAL, type Page };

export const USERS = {
  aygun: "Aygün Məmmədova", // operator
  resad: "Rəşad Əliyev", // approver
  kamran: "Kamran Babayev", // read-only auditor
} as const;
export type User = (typeof USERS)[keyof typeof USERS];

// fixture ids; the seeded database derives its own ids from fixture slugs
const MOCK_IDS: Record<User, string> = {
  "Aygün Məmmədova": "0193a000-0000-7000-8000-000000000001",
  "Rəşad Əliyev": "0193a000-0000-7000-8000-000000000002",
  "Kamran Babayev": "0193a000-0000-7000-8000-000000000005",
};

async function json<T>(res: ReturnType<APIRequestContext["get"]>) {
  const r = await res;
  if (!r.ok()) throw new Error(`e2e setup: ${r.url()} → ${r.status()} ${await r.text()}`);
  return (await r.json()) as T;
}

// one dev login per user and test worker: the API rate-limits logins, and a reseed keeps the
// slug-derived user ids, so a token stays valid for the whole run
const tokens = new Map<User, Promise<string>>();

/** A session token for a demo user: the mock token, or a real dev login. */
export function tokenFor(request: APIRequestContext, user: User) {
  if (!REAL) return Promise.resolve(`mock.${MOCK_IDS[user]}`);
  if (!tokens.has(user))
    tokens.set(
      user,
      login(request, user).catch((e) => (tokens.delete(user), Promise.reject(e))),
    );
  return tokens.get(user)!;
}

async function login(request: APIRequestContext, user: User) {
  const { items } = await json<{ items: { id: string; full_name: string }[] }>(
    request.get(`${API_URL}/v1/auth/dev-users`),
  );
  const id = items.find((u) => u.full_name === user)!.id;
  const s = await json<{ access_token: string }>(
    request.post(`${API_URL}/v1/auth/dev-login`, { data: { user_id: id } }),
  );
  return s.access_token;
}

/** `/packages/INV-1042…` → the package's own path in either mode. */
export async function resolvePath(request: APIRequestContext, token: string, path: string) {
  const m = path.match(/^\/packages\/(INV-(\d+))(.*)$/);
  if (!m) return path;
  if (!REAL) return `/packages/0193a000-0000-7000-8002-00000000${m[2]}${m[3]}`;
  const { items } = await json<{ items: { id: string; invoice_number: string | null }[] }>(
    request.get(`${API_URL}/v1/packages?q=${m[1]}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
  return `/packages/${items.find((p) => p.invoice_number === m[1])!.id}${m[3]}`;
}

/** Signs in as a demo user, then opens `path` (a full load; mock data starts fresh). */
export async function signIn(page: Page, user: User, path: string) {
  const token = await tokenFor(page.request, user);
  await page.goto("/login");
  await page.evaluate((t) => sessionStorage.setItem("payproof.token", t), token);
  await page.goto(await resolvePath(page.request, token, path));
}
