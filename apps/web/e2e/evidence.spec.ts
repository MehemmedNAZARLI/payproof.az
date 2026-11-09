import { expect, REAL, signIn, test, USERS } from "./fixtures";

const AYGUN = USERS.aygun;
const INV_1044 = "INV-1044";

test("INV-1044: the price cell is highlighted and its evidence opens", async ({ page }) => {
  await signIn(page, AYGUN, `/packages/${INV_1044}`);

  const table = page.getByRole("table", { name: "Müqayisə: faktura · sifariş · təhvil" });
  const price = table.getByRole("cell", { name: /^110,00 AZN.*uyğunsuz/ });
  await expect(price).toBeVisible();
  await expect(price).toHaveCSS("background-color", "rgb(251, 232, 230)"); // --danger-bg

  const open = page.getByRole("button", { name: "Mənbəyə bax: KY-10 Vahid qiymət (Faktura)" });
  await open.click();
  const dialog = page.getByRole("dialog", { name: /^Faktura · .+ · v1$/ });
  // each server words its own quote; the line and the price are the same
  await expect(dialog.getByRole("blockquote")).toContainText("50 blok × 110,00");
  // the real seed has no coordinates for this line (and stand-in PDFs): page and quote only
  if (!REAL)
    await expect(dialog.locator("mark")).toHaveText("Kərə yağı 82%, 10 kq blok — 50 blok × 110,00");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
});
