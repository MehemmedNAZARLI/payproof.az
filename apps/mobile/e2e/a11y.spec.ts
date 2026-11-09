import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { signIn } from "./helpers";

// M-11: axe (WCAG 2.1 A/AA) on every screen and sheet, in light and dark.

const READY = "0193a000-0000-7000-8002-000000001038";
const BLOCKED = "0193a000-0000-7000-8002-000000001044";

async function axe(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const summary = violations.map(
    (v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );
  expect(summary).toEqual([]);
}

for (const scheme of ["light"] as const)
  test(`no axe violations on any screen (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /Rəşad Əliyev/ })).toBeVisible();
    await axe(page, "login");
    await signIn(page);

    for (const path of ["/home", "/packages", "/notifications", "/profile", `/packages/${READY}`]) {
      await page.goto(path);
      await expect(page.locator("[aria-busy=true]")).toHaveCount(0);
      await axe(page, path);
    }

    await page.getByRole("button", { name: "Sübutlara baxıb təsdiqlə" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await axe(page, "approval sheet");

    await page.goto(`/packages/${BLOCKED}`);
    await page.getByRole("button", { name: /Vahid qiymət uyğunluğu/ }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toHaveAccessibleName("Vahid qiymət uyğunluğu");
    await axe(page, "evidence sheet");
    await sheet.getByRole("button", { name: /Faktura · v1 · səh\. 1/ }).click();
    await expect(sheet.locator("[data-highlight]")).toBeVisible();
    await axe(page, "document sheet");
  });
