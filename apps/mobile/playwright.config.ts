import { defineConfig, devices } from "@playwright/test";

// Separate port from `dev` (:3001) so e2e never talks to a stale dev or old build server.
const port = 3101;

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${port}`, trace: "off" },
  // Only Chromium ships in the dev container and CI image; keep the iPhone 13 viewport, UA and touch.
  projects: [{ name: "iphone-13", use: { ...devices["iPhone 13"], browserName: "chromium" } }],
  webServer: {
    command: `pnpm build && pnpm exec next start -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
