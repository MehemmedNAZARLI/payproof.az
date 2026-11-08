import { expect, type Page, test } from "@playwright/test";

import { AYGUN, horizontalOverflow, signIn, watchErrors } from "./helpers";

// M-09 approval on the iPhone 13 profile: review gate, one approval, success, every view updated.

const ID = "0193a000-0000-7000-8002-000000001038";
const sheetOf = (page: Page) => page.getByRole("dialog", { name: "INV-1038 paketini təsdiqləyin" });
const confirm = (page: Page) => sheetOf(page).getByRole("button", { name: /Təsdiqlə/ });

async function review(page: Page) {
  const sheet = sheetOf(page);
  for (const name of [/Faktura · v1/, /Sifariş · v1/, /Təhvil sənədi · v1/]) {
    await sheet.getByRole("button", { name }).click();
    await expect(page.getByRole("dialog").getByRole("region")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Geri" }).last().click();
    await expect(sheet).toBeVisible();
  }
  await expect(sheet.getByText("3/3 baxılıb")).toBeVisible();
}

test("reviews every document, approves once and shows it everywhere", async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);
  await expect(page.getByRole("link", { name: /Təsdiqinizi gözləyir/ })).toContainText(/2\s*paket/);
  await page.goto(`/packages/${ID}`);
  await page.getByRole("button", { name: "Sübutlara baxıb təsdiqlə" }).click();

  await expect(confirm(page)).toHaveAttribute("aria-disabled", "true");
  await expect(sheetOf(page).getByRole("checkbox")).toBeDisabled();
  await expect(confirm(page)).toBeInViewport();
  await confirm(page).click({ force: true });
  await expect(page).toHaveURL(new RegExp(`${ID}$`));

  await review(page);
  await sheetOf(page)
    .getByText(/Cari v1 versiyasının/)
    .click();
  await expect(confirm(page)).not.toHaveAttribute("aria-disabled");
  await confirm(page).dblclick();

  await expect(page).toHaveURL(`/packages/${ID}/success`);
  await expect(page.getByRole("heading", { name: "Paket göndərilməyə hazırdır" })).toBeFocused();
  await expect(page.getByText(/4\.860,00 AZN-lik faktura paketi \(INV-1038, v1\)/)).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

  await page.getByRole("link", { name: "Ana səhifəyə qayıt" }).click();
  await expect(page.getByRole("link", { name: /Təsdiqinizi gözləyir/ })).toContainText(/1\s*paket/);
  await page.goto("/packages?status=approved");
  await expect(page.getByRole("link", { name: /INV-1038/ })).toBeVisible();
  await page.goto(`/packages/${ID}`);
  await expect(page.getByRole("link", { name: "Veb tətbiqdə ixrac et" })).toBeVisible();
  await expect(page.getByText(/Təsdiqləyən:\s*Rəşad Əliyev/)).toBeVisible();
  // A double tap made one approval: the activity feed has one new approval event.
  await page.goto("/home");
  await expect(page.getByText(/Paket təsdiqləndi · INV-1038/)).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("an operator sees no approval, only who it waits for", async ({ page }) => {
  await signIn(page, AYGUN);
  await page.goto(`/packages/${ID}`);
  await expect(page.getByText("Təsdiqçi gözlənilir")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sübutlara baxıb təsdiqlə" })).toHaveCount(0);
});

test("approval says plainly that it needs a connection", async ({ page, context }) => {
  await signIn(page);
  await page.goto(`/packages/${ID}`);
  await page.getByRole("button", { name: "Sübutlara baxıb təsdiqlə" }).click();
  await context.setOffline(true);
  await expect(sheetOf(page).getByRole("alert")).toContainText("təsdiq oflayn mümkün deyil");
  await expect(confirm(page)).toHaveAttribute("aria-disabled", "true");
  await context.setOffline(false);
  await expect(sheetOf(page).getByRole("alert")).toHaveCount(0);
});
