import { defineConfig, devices } from "@playwright/test";
import { API_ENV, API_URL, REAL, WEB_PORT } from "./e2e/stack";

// CI and the real stack: a production build on its own port; locally the dev server (reused)
const ci = !!process.env.CI;
const build = ci || REAL;

const web = {
  // mock mode is baked in at build time; prebuild generates the MSW worker
  command: build ? `pnpm build && pnpm exec next start -p ${WEB_PORT}` : "pnpm dev",
  port: WEB_PORT,
  reuseExistingServer: !build,
  timeout: 240_000,
  env: (REAL
    ? { NEXT_PUBLIC_API_MOCK: "0", NEXT_PUBLIC_API_URL: API_URL, NEXT_PUBLIC_DEMO_FILES: "1" }
    : { NEXT_PUBLIC_API_MOCK: "1" }) as Record<string, string>,
};

const api = [
  {
    command: `uv run alembic upgrade head && uv run uvicorn payproof.main:create_app --factory --port ${new URL(API_URL).port} --log-level warning`,
    cwd: "../api",
    url: `${API_URL}/v1/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: API_ENV,
  },
  // no port: Playwright only starts it and stops it with the run
  {
    command: "uv run payproof-worker",
    cwd: "../api",
    env: { ...API_ENV, LOG_LEVEL: "INFO" },
    wait: { stderr: /worker started/ },
  },
];

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  // the real stack has one database, reseeded before each test
  workers: REAL ? 1 : undefined,
  reporter: ci ? "github" : "list",
  use: { baseURL: `http://localhost:${WEB_PORT}`, trace: "on-first-retry" },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: REAL ? [...api, web] : web,
});
