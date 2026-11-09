import { expect, type Page, REAL, signIn, test, USERS } from "./fixtures";

const AYGUN = USERS.aygun;
const pkgUrl = (n: number) => `/packages/INV-${n}`;

async function open(page: Page, n: number) {
  await signIn(page, AYGUN, pkgUrl(n));
  await expect(page.getByRole("region", { name: "Yoxlamalar" })).toBeVisible();
}
const status = (page: Page) => page.getByRole("heading", { level: 1 }).locator("..");

test("INV-1047: correcting the unreadable PO from the source makes the package ready", async ({
  page,
}) => {
  await open(page, 1047);
  await page.getByRole("button", { name: "Mənbəyə bax, sahəni düzəlt" }).click();
  const dialog = page.getByRole("dialog", { name: /^Çıxarışı düzəlt:/ });
  await dialog.getByLabel("Yeni dəyər").fill("PO-397");
  await dialog.getByLabel("Səbəb").fill("Skanda 7 aydın görünür");
  await dialog.getByRole("button", { name: "Düzəlişi yadda saxla" }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByText(/düzəldildi\. Paket v\d+ yenidən yoxlandı: Təsdiq gözləyir\./),
  ).toBeVisible();
  await expect(status(page)).toContainText("Təsdiq gözləyir");
});

test("INV-1042: a new invoice version goes through the stages; the same file again creates none", async ({
  page,
}) => {
  await open(page, 1042);
  const again = async (file: RegExp) => {
    await page.getByRole("button", { name: "Sənəd yüklə" }).click();
    const dialog = page.getByRole("dialog", { name: "INV-1042: sənəd yüklə" });
    await dialog.getByLabel("Sənəd növü").selectOption("invoice");
    await dialog.getByRole("radio", { name: file }).check({ force: true });
    await dialog.getByRole("button", { name: "Yüklə və emal et" }).click();
    return dialog;
  };
  let dialog = await again(/INV-1042_v2_PO-381\.pdf/);
  await expect(dialog).toBeHidden();
  await expect(
    page.getByText(/INV-1042_v2_PO-381\.pdf yükləndi\. Paket v2 yenidən yoxlandı/),
  ).toBeVisible();
  await expect(page.getByText("Paket v2", { exact: true })).toBeVisible();
  const invoice = page.getByRole("article", { name: "Faktura" });
  await expect(invoice).toContainText("INV-1042_v2_PO-381.pdf");
  await expect(invoice).toContainText("Əvvəlki versiyalar (1)");

  // the same file again: refused, nothing changes
  dialog = await again(/INV-1042_v2_PO-381\.pdf/);
  await expect(
    dialog.getByText("Bu fayl paketdə artıq var — yeni versiya yaradılmadı."),
  ).toBeVisible();
  await expect(page.getByText("Paket v2", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  // the replaced version is history now: uploading it again still creates nothing (the real
  // server compares bytes, and a demo file only stands in for the seeded one by name)
  if (REAL) return;
  dialog = await again(/^INV-1042\.pdf/);
  await expect(dialog.getByText(/yeni versiya yaradılmadı/)).toBeVisible();
  await expect(page.getByText("Paket v2", { exact: true })).toBeVisible();
});
