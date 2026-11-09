import { expect, type Page, signIn, test, USERS } from "./fixtures";

const INV_1042 = "/packages/INV-1042";
const status = (page: Page) => page.getByRole("heading", { level: 1 }).locator("..");

async function upload(page: Page, type: "invoice" | "delivery", file: string) {
  await page.getByRole("button", { name: "Sənəd yüklə" }).click();
  const dialog = page.getByRole("dialog", { name: "INV-1042: sənəd yüklə" });
  await dialog.getByLabel("Sənəd növü").selectOption(type);
  await dialog
    .getByRole("radio", { name: new RegExp(`^${file.replace(".", "\\.")}`) })
    .check({ force: true });
  await dialog.getByRole("button", { name: "Yüklə və emal et" }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
  await expect(
    page.getByText(new RegExp(`^${file.replace(".", "\\.")} yükləndi\\.`)),
  ).toBeVisible();
}

// One page from start to end: client-side navigation keeps the in-browser mock data
test("INV-1042 end to end: operator fixes every problem, approver approves and exports", async ({
  page,
}) => {
  test.slow(); // two roles, several jobs
  await signIn(page, USERS.aygun, INV_1042);
  await expect(status(page)).toContainText("Yoxlama tələb edir");

  // 1. a person confirms the AI's order suggestion
  await page.getByRole("button", { name: "Bax və təsdiqlə" }).click();
  const match = page.getByRole("dialog", { name: "INV-1042: sifarişi seçin və təsdiqləyin" });
  await match.getByRole("button", { name: "Seçilmiş sifarişlə əlaqəni təsdiqlə" }).click();
  await expect(status(page)).toContainText("Düzəliş tələb edir");

  // 2. the warehouse's signed delivery note, then accounting's corrected invoice (with PO-381)
  await upload(page, "delivery", "TS-5531_imzali.pdf");
  await upload(page, "invoice", "INV-1042_v2_PO-381.pdf");

  // 3. R-008: a person confirms the signature is visibly there (not legal authentication)
  await page.getByRole("button", { name: "İmzaya bax və təsdiqlə" }).click();
  await page.getByRole("button", { name: "İmzanın mövcudluğunu təsdiqləyirəm" }).click();
  await expect(status(page)).toContainText("Təsdiq gözləyir");
  // the operator cannot approve
  await expect(page.getByRole("button", { name: "Təsdiqlə" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );

  // 4. switch to the approver
  await page.getByRole("button", { name: /Aygün Məmmədova/ }).click();
  await page.getByRole("menuitem", { name: "Çıxış" }).click();
  await page.getByRole("radio", { name: /Rəşad Əliyev/ }).check({ force: true });
  await page.getByRole("button", { name: "Daxil ol" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: /Faktura paketləri/ })
    .click();
  await page.getByRole("link", { name: "INV-1042" }).click();
  await expect(status(page)).toContainText("Təsdiq gözləyir");

  // 5. approve the reviewed version, then export it
  await page.getByRole("button", { name: "Təsdiqlə" }).click();
  const approve = page.getByRole("dialog", { name: "INV-1042 paketini təsdiqlə" });
  await approve.getByRole("checkbox").check();
  await approve.getByRole("button", { name: "Təsdiqlə" }).click();
  await expect(
    page.getByRole("region", { name: "12.000,00 AZN-lik faktura paketi göndərilməyə hazırdır" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "İxrac et" }).click();
  const zip = page.waitForEvent("download");
  await page
    .getByRole("dialog", { name: "INV-1042: ixrac paketi" })
    .getByRole("button", { name: "İxrac et və manifesti yüklə" })
    .click();
  expect((await zip).suggestedFilename()).toMatch(/^PayProof_INV-1042_v\d+\.zip$/);
  await expect(status(page)).toContainText("İxrac edilib");
});
