import { expect, test } from "@playwright/test";

test("swipes through the product story, then remembers completion", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Upload the document set" })).toBeVisible();
  await page.getByRole("button", { name: "Show step 2" }).click();
  await expect(page.getByRole("button", { name: "Show step 2" })).toHaveAttribute(
    "aria-current",
    "step",
  );
  await page.getByRole("button", { name: "Show step 3" }).click();
  await expect(page.getByRole("button", { name: "Show step 3" })).toHaveAttribute(
    "aria-current",
    "step",
  );
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(page.getByRole("heading", { name: "Choose a demo account" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Get started" })).toHaveCount(0);
});

test("can skip the welcome before signing in", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Choose a demo account" })).toBeVisible();
});
