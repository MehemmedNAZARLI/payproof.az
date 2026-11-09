import { expect, type Page, signIn, test, USERS } from "./fixtures";

const AYGUN = USERS.aygun;

async function enter(page: Page, path: string) {
  await signIn(page, AYGUN, path);
}

test("a new package from a demo set opens processing, then shows its result", async ({ page }) => {
  await enter(page, "/packages");
  // let the page settle first: a navigation still in flight would reset the dialog
  await expect(page.getByRole("table", { name: "Faktura paketləri" })).toBeVisible();
  await page.getByRole("button", { name: "Yeni paket" }).click();
  const dialog = page.getByRole("dialog", { name: "Yeni faktura paketi" });
  await dialog.getByText("INV-1051 · C Restoran Qrupu").click(); // the card, as a user would
  await expect(dialog.getByRole("radio", { name: /INV-1051/ })).toBeChecked();
  await expect(dialog.getByLabel("Müştəri")).toHaveValue(/.+/);
  await dialog.getByRole("button", { name: "Paketi yarat və emal et" }).click();
  await expect(page).toHaveURL(/\/packages\/[0-9a-f-]{36}$/);
  await expect(page.getByText("INV-1051 yaradıldı, sənədlər emal olunur…")).toBeVisible();
  await expect(page.getByText(/^INV-1051 emal olundu: /)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("INV-1051");
});

test("a never-approved package can be deleted after confirming", async ({ page }) => {
  await enter(page, "/packages/INV-1048");
  await page.getByRole("button", { name: "Paketi sil" }).click();
  const confirm = page.getByRole("alertdialog", { name: "INV-1048 paketini silmək?" });
  await confirm.getByRole("button", { name: "Bəli, sil" }).click();
  await expect(page).toHaveURL(/\/packages$/);
  await expect(page.getByText("INV-1048 silindi. Audit qeydi saxlanıldı.")).toBeVisible();
  await expect(page.getByRole("table", { name: "Faktura paketləri" })).not.toContainText(
    "INV-1048",
  );
});
