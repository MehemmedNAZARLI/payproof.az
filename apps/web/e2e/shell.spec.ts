import { expect, type Page, signIn, test, USERS } from "./fixtures";

const AYGUN = USERS.aygun;

async function enter(page: Page, path = "/overview") {
  await signIn(page, AYGUN, path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test("keyboard only: skip link, sidebar, search and user menu", async ({ page }) => {
  await enter(page);

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Məzmuna keç" })).toBeFocused();

  // Tab until the sidebar link, then follow it with Enter.
  const packages = page
    .getByRole("navigation", { name: "Əsas naviqasiya" })
    .getByRole("link", { name: "Faktura paketləri" });
  for (let i = 0; i < 15 && !(await packages.evaluate((el) => el === document.activeElement)); i++)
    await page.keyboard.press("Tab");
  await expect(packages).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/packages$/);
  await expect(packages).toHaveAttribute("aria-current", "page");

  await page.getByRole("searchbox", { name: "Paket axtar" }).focus();
  await page.keyboard.type("INV-1042");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/packages\?q=INV-1042$/);

  const account = page.getByRole("button", { name: /Aygün Məmmədova/ });
  await account.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(account).toBeFocused();
});

// every main page: wide tables and grids scroll inside their own box, never the page
const PAGES = {
  "/overview": "İcmal",
  "/packages": "Faktura paketləri",
  "/packages/INV-1042": "INV-1042",
  "/tasks": "Tapşırıqlar",
  "/rules": "Müştəri qaydaları",
  "/audit": "Audit tarixçəsi",
};
for (const [path, width] of Object.keys(PAGES).flatMap((p) =>
  [768, 1024, 1440].map((w) => [p, w] as const),
)) {
  test(`no horizontal scroll on ${path} at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await enter(page, path);
    // not "networkidle": the live event stream (ADR-0010) keeps a request open for good
    await expect(
      page.getByRole("heading", { level: 1, name: PAGES[path as keyof typeof PAGES] }),
    ).toBeVisible();
    await expect(page.locator('[aria-busy="true"], [data-slot="skeleton"]')).toHaveCount(0);
    // the page itself and the scrolling content area (<main> scrolls on its own)
    const overflow = await page.evaluate(() =>
      [document.documentElement, document.getElementById("content")!].map(
        (el) => el.scrollWidth - el.clientWidth,
      ),
    );
    expect(overflow).toEqual([0, 0]);
  });
}

test("below 768px the sidebar is a drawer", async ({ page }) => {
  await page.setViewportSize({ width: 767, height: 800 });
  await enter(page);
  await expect(page.getByRole("navigation", { name: "Əsas naviqasiya" })).toBeHidden();

  const menuButton = page.getByRole("button", { name: "Menyunu aç" });
  await menuButton.click();
  const drawer = page.getByRole("dialog", { name: "Menyu" });
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(menuButton).toBeFocused();

  await menuButton.click();
  await drawer.getByRole("link", { name: /^Tapşırıqlar/ }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(drawer).toBeHidden();
});
