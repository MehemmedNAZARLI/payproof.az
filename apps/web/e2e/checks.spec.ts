import { expect, type Page, signIn, test, USERS } from "./fixtures";

const AYGUN = USERS.aygun;
const pkgUrl = (n: number) => `/packages/INV-${n}`;

async function open(page: Page, n: number) {
  await signIn(page, AYGUN, pkgUrl(n));
  await expect(page.getByRole("region", { name: "Yoxlamalar" })).toBeVisible();
}

test("INV-1042: confirming the order link re-validates the package to NEEDS_FIX", async ({
  page,
}) => {
  await open(page, 1042);
  await expect(page.getByRole("heading", { level: 1 }).locator("..")).toContainText(
    "Yoxlama tələb edir",
  );
  await page.getByRole("button", { name: "Bax və təsdiqlə" }).click();
  const dialog = page.getByRole("dialog", { name: "INV-1042: sifarişi seçin və təsdiqləyin" });
  await dialog.getByRole("button", { name: "Seçilmiş sifarişlə əlaqəni təsdiqlə" }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByText(
      /PO-381 ilə əlaqə təsdiqləndi\. Paket v2 yenidən yoxlandı: Düzəliş tələb edir\./,
    ),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 }).locator("..")).toContainText(
    "Düzəliş tələb edir",
  );
  await expect(page.getByText("Paket v2", { exact: true })).toBeVisible();
});

test("INV-1048: confirming without choosing an order shows an inline error", async ({ page }) => {
  await open(page, 1048);
  await page
    .getByRole("region", { name: "Yoxlamalar" })
    .getByRole("button", { name: "Sifarişi seç" })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "INV-1048: sifarişi seçin və təsdiqləyin" });
  await dialog.getByRole("button", { name: "Seçilmiş sifarişlə əlaqəni təsdiqlə" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Sifarişlərdən birini seçin.");
  await expect(dialog).toBeVisible(); // nothing was sent
});
