import { expect, test } from "./fixtures";

const bodyBg = (page: import("@playwright/test").Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test("html is Azerbaijani and uses light tokens by default", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "az");
  expect(await bodyBg(page)).toBe("rgb(244, 245, 242)"); // --bg light #f4f5f2
});

test("dark tokens follow the OS and data-theme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login");
  expect(await bodyBg(page)).toBe("rgb(14, 19, 18)"); // --bg dark #0e1312
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  expect(await bodyBg(page)).toBe("rgb(244, 245, 242)");
});
