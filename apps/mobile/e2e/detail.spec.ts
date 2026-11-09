import { expect, test } from "@playwright/test";

import { AYGUN, horizontalOverflow, signIn, watchErrors } from "./helpers";

// M-07 package detail on the iPhone 13 profile.

const CTA: Record<string, RegExp> = {
  "INV-1042": /Approval unavailable/,
  "INV-1038": /Review evidence and approve/,
  "INV-1036": /Review evidence and approve/,
  "INV-1043": /Approval unavailable/,
  "INV-1044": /Approval unavailable/,
  "INV-1045": /Approval unavailable/,
  "INV-1046": /Approval unavailable/,
  "INV-1047": /Approval unavailable/,
  "INV-1048": /Approval unavailable/,
  "INV-1049": /Approval unavailable/,
  "INV-1035": /Export on web/,
  "INV-1033": /v1 exported/,
  "INV-1031": /v1 exported/,
};

test("all 14 packages open from the list, each with the right call to action", async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);
  await page.goto("/packages");
  const rows = page.getByRole("list", { name: "Packages" }).getByRole("link");
  await expect(rows).toHaveCount(14);
  for (let i = 0; i < 14; i++) {
    await rows.nth(i).click();
    await expect(page).toHaveURL(/\/packages\/[0-9a-f-]{36}$/);
    const title = page.getByRole("heading", { level: 1 });
    await expect(title).not.toHaveText(/Loading/);
    const invoice = (await title.textContent()) ?? "";
    if (invoice in CTA) await expect(page.getByText(CTA[invoice]!).first()).toBeVisible();
    else await expect(page.getByRole("heading", { name: "Processing" })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await page.getByRole("link", { name: "Packages" }).click();
    await expect(rows).toHaveCount(14);
  }
  expect(errors).toEqual([]);
});

test("an operator waits for the approver on a ready package", async ({ page }) => {
  await signIn(page, AYGUN);
  await page.goto("/packages?status=ready");
  await page.getByRole("link", { name: /INV-1038/ }).click();
  await expect(page.getByText("Awaiting approver")).toBeVisible();
  await expect(page.getByRole("button", { name: "Review evidence and approve" })).toHaveCount(0);
});

test("an unknown package says so", async ({ page }) => {
  await signIn(page);
  await page.goto("/packages/0193a000-0000-7000-8002-000000009999");
  await expect(page.getByRole("heading", { level: 1, name: "Package not found" })).toBeVisible();
});
