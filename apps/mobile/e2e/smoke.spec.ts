import { expect, test } from "@playwright/test";

test("renders the shell without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "PayProof" })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const width of [360, 390, 430]) {
  test(`has no horizontal scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("is installable: manifest, service worker, no Chrome installability errors", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  const res = await page.request.get(href ?? "");
  expect(res.ok()).toBe(true);
  expect(await res.json()).toMatchObject({ name: "PayProof", display: "standalone" });

  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(new URL(scope).pathname).toBe("/");

  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  // Playwright's isolated context is incognito. Assert every application-related requirement.
  expect(installabilityErrors.filter((error) => error.errorId !== "in-incognito")).toEqual([]);
});
