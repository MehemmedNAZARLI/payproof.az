import { expect, test } from "@playwright/test";

import { signIn, watchErrors } from "./helpers";

// M-11 PWA behaviour against the production build: offline reading after a relaunch, the
// update prompt, and the add-to-home-screen hint (the iPhone 13 profile is iPhone Safari).

const READY = "0193a000-0000-7000-8002-000000001038";
const rows = (page: import("@playwright/test").Page) =>
  page.getByRole("list", { name: "Packages" }).getByRole("listitem");

async function controlled(page: import("@playwright/test").Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

test("reopens offline with the last loaded list and detail, read-only", async ({
  page,
  context,
}) => {
  const errors = watchErrors(page);
  await signIn(page);
  await controlled(page);
  await page.goto("/packages");
  await expect(rows(page)).toHaveCount(14);
  await page.goto(`/packages/${READY}`);
  await expect(page.getByRole("heading", { level: 1, name: "INV-1038" })).toBeVisible();
  await page.waitForTimeout(800); // the offline cache writes shortly after data arrives

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "INV-1038" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Oflayn" })).toBeVisible();
  const approve = page.getByRole("button", { name: "Review evidence and approve" });
  await expect(approve).toBeDisabled();
  await expect(page.getByText("Approval requires you to be online")).toBeVisible();

  await page.goto("/packages");
  await expect(rows(page)).toHaveCount(14);
  await context.setOffline(false);
  await expect(page.getByRole("status").filter({ hasText: "Oflayn" })).toHaveCount(0);
  expect(errors.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to fetch/.test(e))).toEqual([]);
});

test("a different user never sees the previous user's saved data", async ({ page }) => {
  await signIn(page);
  await page.goto("/packages");
  await expect(rows(page)).toHaveCount(14);
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => localStorage.getItem("payproof.cache"))).toContain("INV-1038");
  await page.goto("/profile");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(await page.evaluate(() => localStorage.getItem("payproof.cache"))).toBeNull();
});

test("offers a new version instead of switching under the user", async ({ page }) => {
  await signIn(page);
  await controlled(page);
  const first = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL);
  // A deploy. The browser's own update check cannot be intercepted here, so the same worker is
  // registered under a new URL: it installs beside the active one and waits, as a deploy does.
  await page.evaluate(() => navigator.serviceWorker.register("/serwist/sw.js?v=2", { scope: "/" }));
  const toast = page.getByRole("status").filter({ hasText: "Update available" });
  await expect(toast).toBeVisible();
  // Nothing switched yet: the old worker still controls this page.
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toBe(first);
  const reloaded = page.waitForEvent("load");
  await toast.getByRole("button", { name: "Refresh" }).click();
  await reloaded;
  // The page now runs on the new worker. (The app then registers its canonical URL again, which
  // in this simulation installs once more; a real deploy keeps one URL.)
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toContain("v=2");
});

test("shows iPhone users how to add the app, and remembers a dismissal", async ({ page }) => {
  await signIn(page);
  const card = page.getByRole("heading", { name: "Add to Home Screen" });
  await expect(card).toBeVisible();
  await page.getByRole("button", { name: "Add" }).click();
  const sheet = page.getByRole("dialog", { name: "Add to Home Screen in Safari" });
  await expect(sheet.getByText(/Tap Share/)).toBeVisible();
  await sheet.getByRole("button", { name: "Got it" }).click();
  await page.getByRole("button", { name: "Dismiss tip" }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(card).toHaveCount(0);
  await page.goto("/profile");
  await expect(page.getByRole("button", { name: "Add to Home Screen" })).toBeVisible();
});
