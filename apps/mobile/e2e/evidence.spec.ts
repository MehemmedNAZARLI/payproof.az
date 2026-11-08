import { expect, type Page, test } from "@playwright/test";

import { horizontalOverflow, signIn, watchErrors } from "./helpers";

// M-08 evidence and document sheets on the iPhone 13 profile.

const detail = (n: number) => `/packages/0193a000-0000-7000-8002-00000000${n}`;
const documents = (page: Page) => page.getByRole("list", { name: "Sənədlər" });

test.beforeEach(async ({ page }) => signIn(page));

test("follows a check to the cited row on the invoice and back", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(detail(1044));
  await page.getByRole("button", { name: /Vahid qiymət uyğunluğu/ }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toHaveAccessibleName("Vahid qiymət uyğunluğu");
  await sheet.getByRole("button", { name: /Faktura · v1 · səh\. 1/ }).click();
  await expect(sheet).toHaveAccessibleName("Faktura · v1");
  const cited = sheet.locator("[data-highlight]");
  await expect(cited).toContainText("KY-10");
  await expect(cited).toBeInViewport();
  await sheet.getByRole("button", { name: "Geri" }).last().click();
  await expect(sheet).toHaveAccessibleName("Vahid qiymət uyğunluğu");
  await sheet.getByRole("button", { name: "Bağla" }).last().click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("counts seen documents for this session and forgets them on sign-out", async ({ page }) => {
  await page.goto(detail(1038));
  await expect(page.getByText("0/3 baxılıb")).toBeVisible();
  for (const name of [/Faktura · v1/, /Sifariş · v1/, /Təhvil sənədi · v1/]) {
    await documents(page).getByRole("button", { name }).click();
    await expect(page.getByRole("dialog").getByRole("region")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Bağla" }).last().click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await expect(page.getByText("3/3 baxılıb")).toBeVisible();
  await page.reload();
  await expect(page.getByText("3/3 baxılıb")).toBeVisible();

  await page.goto("/profile");
  await page.getByRole("button", { name: "Hesabdan çıx" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Hesabdan çıx" }).click();
  await signIn(page);
  await page.goto(detail(1038));
  await expect(page.getByText("0/3 baxılıb")).toBeVisible();
});

test("a phone on its side reads documents full-screen", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto(detail(1044));
  await page.getByRole("button", { name: /Vahid qiymət uyğunluğu/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Faktura · v1 · səh\. 1/ })
    .click();
  const sheet = page.getByRole("dialog", { name: "Faktura · v1" });
  await expect(sheet.locator("[data-highlight]")).toBeInViewport();
  const box = (await sheet.boundingBox())!;
  expect(box.width).toBe(844);
  expect(Math.round(box.height)).toBe(390);
  // The footer gives way; "Geri" moves into the header.
  await expect(sheet.getByRole("button", { name: "Geri" })).toHaveCount(1);
  await sheet.getByRole("button", { name: "Geri" }).click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Vahid qiymət uyğunluğu");
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
});

test("zooms a document with the buttons and back to fit", async ({ page }) => {
  await page.goto(detail(1038));
  await documents(page)
    .getByRole("button", { name: /Faktura · v1/ })
    .click();
  const sheet = page.getByRole("dialog");
  const paper = sheet.getByRole("article");
  const fit = (await paper.boundingBox())!.width;
  await sheet.getByRole("button", { name: "Böyüt" }).click();
  await expect.poll(async () => (await paper.boundingBox())!.width).toBeGreaterThan(fit * 1.4);
  await sheet.getByRole("button", { name: "Ekrana sığdır" }).click();
  await expect
    .poll(async () => Math.round((await paper.boundingBox())!.width))
    .toBe(Math.round(fit));
});

test("renders a real PDF with pdf.js in the production build", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/kit");
  await page.getByRole("button", { name: "PDF-ə bax" }).click();
  await expect(page.getByRole("dialog").locator("canvas")).toHaveCount(2);
  await expect(page.getByText(/yükləndi/)).toBeVisible();
  expect(errors).toEqual([]);
});

for (const width of [360, 430])
  test(`detail and sheets fit a ${width}px screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(detail(1042));
    await expect(page.getByRole("heading", { level: 1, name: "INV-1042" })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: /Məcburi sifariş nömrəsi/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
