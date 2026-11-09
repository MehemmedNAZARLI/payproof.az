import { expect, type Page, test } from "@playwright/test";

import { AYGUN, signIn, signOutInApp, tabLink, watchErrors } from "./helpers";

// M-10 notifications on the iPhone 13 profile.

const tab = (page: Page) => tabLink(page, "Bildirişlər");
const ID_1038 = "0193a000-0000-7000-8002-000000001038";

test("badges unread notifications and opens the right package", async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);
  await expect(page.getByRole("link", { name: "Bildirişlər, 2 oxunmamış" }).first()).toBeVisible();
  await expect(tab(page)).toHaveAccessibleName("Bildirişlər, 2 oxunmamış");

  await tab(page).click();
  await expect(page.getByRole("heading", { level: 1, name: "Bildirişlər" })).toBeVisible();
  await expect(page.getByText("2 oxunmamış")).toBeVisible();
  await page.getByRole("link", { name: /INV-1038 təsdiqinizi gözləyir/ }).click();
  await expect(page).toHaveURL(`/packages/${ID_1038}`);
  await expect(page.getByRole("heading", { level: 1, name: "INV-1038" })).toBeVisible();

  await page.goBack();
  await expect(page.getByText("1 oxunmamış")).toBeVisible();
  await expect(tab(page)).toHaveAccessibleName("Bildirişlər, 1 oxunmamış");
  await page.getByRole("button", { name: "Hamısını oxu" }).click();
  await expect(page.getByText("Hamısı oxunub")).toBeVisible();
  await expect(tab(page)).toHaveAccessibleName("Bildirişlər");
  // Still read after leaving the screen and coming back (the server agreeing is a unit test).
  await tabLink(page, "Əsas").click();
  await tab(page).click();
  await expect(page.getByText("Hamısı oxunub")).toBeVisible();
  await expect(tab(page)).toHaveAccessibleName("Bildirişlər");
  expect(errors).toEqual([]);
});

test("the package owner is told when the approver approves", async ({ page }) => {
  await signIn(page, AYGUN);
  await expect(tab(page)).toHaveAccessibleName(/\d+ oxunmamış/);
  const before = Number((await tab(page).getAttribute("aria-label"))!.match(/\d+/)![0]);
  // One tab throughout: the mock DB lives in the page, so the users switch in the app.
  await signOutInApp(page);

  await signIn(page);
  await page
    .getByRole("list", { name: "Təsdiq gözləyənlər" })
    .getByRole("link", { name: /INV-1038/ })
    .click();
  await page.getByRole("button", { name: "Sübutlara baxıb təsdiqlə" }).click();
  const sheet = page.getByRole("dialog");
  for (const name of [/Faktura · v1/, /Sifariş · v1/, /Təhvil sənədi · v1/]) {
    await sheet.getByRole("button", { name }).click();
    await expect(sheet.getByRole("region")).toBeVisible();
    await sheet.getByRole("button", { name: "Geri" }).last().click();
  }
  await sheet.getByText(/Cari v1 versiyasının/).click();
  await sheet.getByRole("button", { name: /Təsdiqlə/ }).click();
  await expect(page).toHaveURL(/success$/);

  await page.getByRole("link", { name: "Ana səhifəyə qayıt" }).click();
  await signOutInApp(page);
  await signIn(page, AYGUN);
  await expect(tab(page)).toHaveAccessibleName(`Bildirişlər, ${before + 1} oxunmamış`);
  await tab(page).click();
  // Newest first. Its day heading follows the mock's demo clock, not the device's.
  await expect(page.getByRole("main").getByRole("link").first()).toHaveAccessibleName(
    /INV-1038 Rəşad Əliyev tərəfindən təsdiqləndi/,
  );
});
