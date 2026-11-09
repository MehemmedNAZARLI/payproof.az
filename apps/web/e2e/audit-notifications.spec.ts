import { expect, type Page, signIn, test, USERS } from "./fixtures";

const AYGUN = USERS.aygun;

async function enter(page: Page, path: string) {
  await signIn(page, AYGUN, path);
}

test("audit: search narrows the log, the URL keeps it, CSV downloads", async ({ page }) => {
  await enter(page, "/audit");
  const table = page.getByRole("table", { name: "Audit hadisələri" });
  await expect(table).toBeVisible();
  await page.getByRole("searchbox", { name: "Auditdə axtar" }).fill("INV-1036");
  await expect(page).toHaveURL(/\/audit\?q=INV-1036$/);
  await expect(table.getByRole("link", { name: "INV-1036" }).first()).toBeVisible();
  const csv = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV yüklə" }).click();
  expect((await csv).suggestedFilename()).toBe("PayProof_audit.csv");
});

test("notifications: unread count, a click opens the package and reads it", async ({ page }) => {
  await enter(page, "/overview");
  const bell = page.getByRole("button", { name: /^Bildirişlər, [1-9]\d* oxunmamış$/ });
  const before = Number((await bell.getAttribute("aria-label"))!.match(/\d+/)![0]);
  await bell.click();
  const pop = page.getByRole("dialog", { name: "Bildirişlər" });
  await pop
    .getByRole("button")
    .filter({ hasText: /^Oxunmamış:/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/packages\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("button", { name: /^Bildirişlər,/ })).toHaveAccessibleName(
    `Bildirişlər, ${before - 1} oxunmamış`,
  );
  await page.getByRole("button", { name: /^Bildirişlər,/ }).click();
  await pop.getByRole("button", { name: "Hamısını oxunmuş et" }).click();
  await expect(page.getByRole("button", { name: /^Bildirişlər,/ })).toHaveAccessibleName(
    "Bildirişlər, 0 oxunmamış",
  );
});
