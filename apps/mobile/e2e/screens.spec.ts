import { expect, test } from "@playwright/test";

import { horizontalOverflow, pullDown, signIn, watchErrors } from "./helpers";

// M-05 home and M-06 package list on the iPhone 13 profile.

test.beforeEach(async ({ page }) => signIn(page));

test("home tiles open the package list filtered", async ({ page }) => {
  await page.getByRole("link", { name: /Düzəliş tələb edir/ }).click();
  await expect(page).toHaveURL("/packages?status=problem");
  await expect(page.getByRole("list", { name: "Paketlər" }).getByRole("listitem")).toHaveCount(8);
});

test("keeps search and filter in the URL across a reload", async ({ page }) => {
  await page.goto("/packages");
  await page.getByRole("button", { name: /^Problemli/ }).click();
  await page.getByRole("searchbox", { name: "Paket axtar" }).fill("restoran");
  await expect(page).toHaveURL("/packages?status=problem&q=restoran");
  const rows = page.getByRole("list", { name: "Paketlər" }).getByRole("listitem");
  await expect(rows.first()).toContainText("C Restoran Qrupu");
  const count = await rows.count();
  await page.reload();
  await expect(rows).toHaveCount(count);
  await expect(page.getByRole("searchbox", { name: "Paket axtar" })).toHaveValue("restoran");
});

for (const path of ["/home", "/packages", "/notifications"])
  test(`${path} refreshes with a pull from the top, keeping its content`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(path);
    const ptr = page.getByTestId("ptr");
    await expect(page.locator("main [aria-busy=true]")).toHaveCount(0);
    // The refresh can finish before the finger lifts, so record that it ran.
    await ptr.evaluate((el) => {
      new MutationObserver(() => {
        if (el.dataset.busy === "true") el.dataset.refreshed = "";
      }).observe(el, { attributes: true, attributeFilter: ["data-busy"] });
    });
    await pullDown(page);
    await expect(ptr).toHaveAttribute("data-refreshed");
    await expect(ptr).toHaveAttribute("data-busy", "false");
    await expect(ptr).not.toHaveAttribute("data-pulling");
    // A short pull only bounces.
    await ptr.evaluate((el) => delete el.dataset.refreshed);
    await pullDown(page, 50);
    await expect(ptr).not.toHaveAttribute("data-pulling");
    await expect(ptr).not.toHaveAttribute("data-refreshed");
    expect(errors).toEqual([]);
  });

for (const path of ["/home", "/packages", "/profile"])
  test(`${path} has no horizontal scroll or console errors at 360–430px`, async ({ page }) => {
    const errors = watchErrors(page);
    for (const width of [360, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    }
    expect(errors).toEqual([]);
  });
