import { expect, test } from "@playwright/test";

import { horizontalOverflow, signIn, watchErrors } from "./helpers";

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

test("refreshes the list from the header button", async ({ page }) => {
  await page.goto("/packages");
  const rows = page.getByRole("list", { name: "Paketlər" }).getByRole("listitem");
  await expect(rows).toHaveCount(14);
  await page.getByRole("button", { name: "Yenilə" }).click();
  await expect(rows).toHaveCount(14);
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
