import { expect, test } from "@playwright/test";

import { horizontalOverflow, signIn } from "./helpers";

test("opens UNEC and shows real statement matches and the blocking mismatch", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: /UNEC · Student grant/ }).click();
  await expect(page.getByRole("heading", { name: "Statement transaction matching" })).toBeVisible();
  await expect(page.getByText("Matched", { exact: true })).toHaveCount(3);
  await expect(page.getByText("12.09.2026  KITAB EVI MMC  -135,00")).toBeVisible();
  await page.getByRole("button", { name: /QR-2026-0927/ }).click();
  await expect(page.getByText("No matching transaction", { exact: true })).toBeVisible();
  await expect(page.getByText(/Difference: 36,00 AZN/)).toBeVisible();
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  }
});
