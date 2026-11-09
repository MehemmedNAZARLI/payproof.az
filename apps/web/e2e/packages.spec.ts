import { expect, type Page, signIn, test, USERS } from "./fixtures";

const AYGUN = USERS.aygun;
const rows = (page: Page) =>
  page.getByRole("table", { name: "Faktura paketləri" }).locator("tbody tr");

test.beforeEach(async ({ page }) => {
  await signIn(page, AYGUN, "/login");
});

test("a shared URL opens the same view, also after reload", async ({ page }) => {
  await page.goto("/packages?status=NEEDS_FIX&sort=-total");
  await expect(rows(page)).toHaveCount(4);
  await expect(page.getByRole("combobox", { name: "Status" })).toHaveValue("NEEDS_FIX");
  await expect(page.getByRole("columnheader", { name: /Məbləğ/ })).toHaveAttribute(
    "aria-sort",
    "descending",
  );
  const order = await rows(page).locator("td:first-child a").allTextContents();
  await page.reload();
  await expect(rows(page)).toHaveCount(4);
  expect(await rows(page).locator("td:first-child a").allTextContents()).toEqual(order);
});

test("filters work on the mock data and Back restores the previous filter", async ({ page }) => {
  await page.goto("/packages");
  await expect(rows(page)).toHaveCount(14);
  await page.getByRole("combobox", { name: "Status" }).selectOption("NEEDS_REVIEW");
  await expect(page).toHaveURL(/\/packages\?status=NEEDS_REVIEW$/);
  await expect(rows(page)).toHaveCount(4);
  await page.getByRole("combobox", { name: "Problem növü" }).selectOption("R-001");
  await expect(page).toHaveURL(/status=NEEDS_REVIEW&issue=R-001$/);
  for (const row of await rows(page).all()) await expect(row).toContainText("Yoxlama tələb edir");

  await page.goBack();
  await expect(page).toHaveURL(/\/packages\?status=NEEDS_REVIEW$/);
  await expect(page.getByRole("combobox", { name: "Problem növü" })).toHaveValue("");
  await expect(rows(page)).toHaveCount(4);
});

test("search is debounced into the URL without one history entry per key", async ({ page }) => {
  await page.goto("/packages");
  await page.goto("/packages?status=NEEDS_FIX");
  await page.getByRole("searchbox", { name: "Axtarış" }).pressSequentially("INV-1043");
  await expect(page).toHaveURL(/\/packages\?q=INV-1043&status=NEEDS_FIX$/);
  await expect(rows(page)).toHaveCount(1);
  await page.goBack();
  await expect(page).toHaveURL(/\/packages$/);
});

test("rows open the package by mouse and by keyboard", async ({ page }) => {
  await page.goto("/packages?q=INV-1042");
  await rows(page).first().locator("td").nth(1).click();
  await expect(page).toHaveURL(/\/packages\/[0-9a-f-]{36}$/);

  await page.goto("/packages?q=INV-1042");
  await page.getByRole("link", { name: "INV-1042" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/packages\/[0-9a-f-]{36}$/);
});
