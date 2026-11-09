import { expect, type Page, test } from "@playwright/test";

import { AYGUN, signIn, signOutInApp, tabLink, watchErrors } from "./helpers";

// M-10 notifications on the iPhone 13 profile.

const tab = (page: Page) => tabLink(page, "Notifications");
const ID_1038 = "0193a000-0000-7000-8002-000000001038";

test("badges unread notifications and opens the right package", async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);
  await expect(page.getByRole("link", { name: "Notifications, 2 unread" }).first()).toBeVisible();
  await expect(tab(page)).toHaveAccessibleName("Notifications, 2 unread");

  await tab(page).click();
  await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
  await expect(page.getByText("2 unread")).toBeVisible();
  await page.getByRole("link", { name: /INV-1038 is awaiting your approval/ }).click();
  await expect(page).toHaveURL(`/packages/${ID_1038}`);
  await expect(page.getByRole("heading", { level: 1, name: "INV-1038" })).toBeVisible();

  await page.goBack();
  await expect(page.getByText("1 unread")).toBeVisible();
  await expect(tab(page)).toHaveAccessibleName("Notifications, 1 unread");
  await page.getByRole("button", { name: "Mark all read" }).click();
  await expect(page.getByText("All read")).toBeVisible();
  await expect(tab(page)).toHaveAccessibleName("Notifications");
  // Still read after leaving the screen and coming back (the server agreeing is a unit test).
  await tabLink(page, "Home").click();
  await tab(page).click();
  await expect(page.getByText("All read")).toBeVisible();
  await expect(tab(page)).toHaveAccessibleName("Notifications");
  expect(errors).toEqual([]);
});

test("the package owner is told when the approver approves", async ({ page }) => {
  await signIn(page, AYGUN);
  await expect(tab(page)).toHaveAccessibleName(/\d+ unread/);
  const before = Number((await tab(page).getAttribute("aria-label"))!.match(/\d+/)![0]);
  // One tab throughout: the mock DB lives in the page, so the users switch in the app.
  await signOutInApp(page);

  await signIn(page);
  await page
    .getByRole("list", { name: "Awaiting approval" })
    .getByRole("link", { name: /INV-1038/ })
    .click();
  await page.getByRole("button", { name: "Review evidence and approve" }).click();
  const sheet = page.getByRole("dialog");
  for (const name of [/Invoice · v1/, /Order · v1/, /Delivery document · v1/]) {
    await sheet.getByRole("button", { name }).click();
    await expect(sheet.getByRole("region")).toBeVisible();
    await sheet.getByRole("button", { name: "Back" }).last().click();
  }
  await sheet.getByText(/I reviewed the documents and check results for v1/).click();
  await sheet.getByRole("button", { name: /Approve/ }).click();
  await expect(page).toHaveURL(/success$/);

  await page.getByRole("link", { name: "Back to home" }).click();
  await signOutInApp(page);
  await signIn(page, AYGUN);
  await expect(tab(page)).toHaveAccessibleName(`Notifications, ${before + 1} unread`);
  await tab(page).click();
  // Newest first. Its day heading follows the mock's demo clock, not the device's.
  await expect(page.getByRole("main").getByRole("link").first()).toHaveAccessibleName(
    /INV-1038 Rəşad Əliyev approved the package/,
  );
});
