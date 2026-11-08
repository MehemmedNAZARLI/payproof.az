import { expect, test } from "@playwright/test";

import { AYGUN, horizontalOverflow, signIn, watchErrors } from "./helpers";

// M-07 package detail on the iPhone 13 profile.

const CTA: Record<string, RegExp> = {
  "INV-1042": /Təsdiq mümkün deyil/,
  "INV-1038": /Sübutlara baxıb təsdiqlə/,
  "INV-1036": /Sübutlara baxıb təsdiqlə/,
  "INV-1043": /Təsdiq mümkün deyil/,
  "INV-1044": /Təsdiq mümkün deyil/,
  "INV-1045": /Təsdiq mümkün deyil/,
  "INV-1046": /Təsdiq mümkün deyil/,
  "INV-1047": /Təsdiq mümkün deyil/,
  "INV-1048": /Təsdiq mümkün deyil/,
  "INV-1049": /Təsdiq mümkün deyil/,
  "INV-1035": /Veb tətbiqdə ixrac et/,
  "INV-1033": /v1 ixrac edilib/,
  "INV-1031": /v1 ixrac edilib/,
};

test("all 14 packages open from the list, each with the right call to action", async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);
  await page.goto("/packages");
  const rows = page.getByRole("list", { name: "Paketlər" }).getByRole("link");
  await expect(rows).toHaveCount(14);
  for (let i = 0; i < 14; i++) {
    await rows.nth(i).click();
    await expect(page).toHaveURL(/\/packages\/[0-9a-f-]{36}$/);
    const title = page.getByRole("heading", { level: 1 });
    await expect(title).not.toHaveText(/Yüklənir/);
    const invoice = (await title.textContent()) ?? "";
    if (invoice in CTA) await expect(page.getByText(CTA[invoice]!).first()).toBeVisible();
    else await expect(page.getByRole("heading", { name: "Emal olunur" })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await page.getByRole("link", { name: "Paketlər" }).click();
    await expect(rows).toHaveCount(14);
  }
  expect(errors).toEqual([]);
});

test("an operator waits for the approver on a ready package", async ({ page }) => {
  await signIn(page, AYGUN);
  await page.goto("/packages?status=ready");
  await page.getByRole("link", { name: /INV-1038/ }).click();
  await expect(page.getByText("Təsdiqçi gözlənilir")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sübutlara baxıb təsdiqlə" })).toHaveCount(0);
});

test("an unknown package says so", async ({ page }) => {
  await signIn(page);
  await page.goto("/packages/0193a000-0000-7000-8002-000000009999");
  await expect(page.getByRole("heading", { level: 1, name: "Paket tapılmadı" })).toBeVisible();
});
