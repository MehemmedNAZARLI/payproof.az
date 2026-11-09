import AxeBuilder from "@axe-core/playwright";
import { expect, signIn, test, USERS } from "./fixtures";

const PAGES = [
  { path: "/overview", ready: "İcmal" },
  { path: "/packages", ready: "Faktura paketləri" },
  { path: "/packages/INV-1042", ready: "INV-1042" },
  { path: "/tasks", ready: "Tapşırıqlar" },
  { path: "/rules", ready: "Müştəri qaydaları" },
  { path: "/audit", ready: "Audit tarixçəsi" },
];

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    for (const { path, ready } of PAGES)
      test(`${path}: no serious or critical WCAG 2.1 AA violations`, async ({ page }) => {
        await signIn(page, USERS.aygun, path);
        await expect(page.getByRole("heading", { level: 1, name: ready })).toBeVisible();
        await expect(page.locator('[aria-busy="true"], [data-slot="skeleton"]')).toHaveCount(0);
        const { violations } = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .exclude("nextjs-portal") // the dev-only Next.js indicator
          .analyze();
        const serious = violations
          .filter((v) => v.impact === "serious" || v.impact === "critical")
          .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
        expect(serious).toEqual([]);
      });

    test("/login: no serious or critical WCAG 2.1 AA violations", async ({ page }) => {
      await page.goto("/login");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .exclude("nextjs-portal")
        .analyze();
      expect(
        violations
          .filter((v) => v.impact === "serious" || v.impact === "critical")
          .map((v) => v.id),
      ).toEqual([]);
    });
  });
}
