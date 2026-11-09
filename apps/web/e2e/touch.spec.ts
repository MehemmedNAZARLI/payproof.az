import { expect, type Page, signIn, test, USERS } from "./fixtures";

const AYGUN = USERS.aygun;
const INTERACTIVE =
  "button:visible, a:visible, input:visible, [role=menuitem]:visible, [role=menuitemradio]:visible";

async function heights(page: Page) {
  await signIn(page, AYGUN, "/overview");
  await expect(page.getByRole("heading", { name: "İcmal" })).toBeVisible();
  // measure the loaded page: skeletons have no links yet
  await expect(page.locator('[aria-busy="true"], [data-slot="skeleton"]')).toHaveCount(0);
  await page.getByRole("button", { name: /Aygün Məmmədova/ }).click(); // menu items too
  await expect(page.getByRole("menu")).toBeVisible();
  return page.locator(INTERACTIVE).evaluateAll((els) =>
    els
      .filter(
        (el) => !el.closest(".sr-only") && !el.matches(".sr-only, [data-nextjs-dev-tools-button]"),
      )
      .map((el) => ({
        name: el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 30),
        // a tap anywhere on an input's <label> focuses it, so the label is the target
        h: (el.matches("input") ? (el.closest("label") ?? el) : el).getBoundingClientRect().height,
      })),
  );
}

test.describe("coarse pointer (touch)", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 1024, height: 800 } });

  test("every interactive element is at least 44px tall", async ({ page }) => {
    const small = (await heights(page)).filter((el) => el.h < 44);
    expect(small).toEqual([]);
  });
});

test("fine pointer (mouse) keeps the compact desktop sizes", async ({ page }) => {
  const all = await heights(page);
  expect(all.some((el) => el.h < 44)).toBe(true);
});
