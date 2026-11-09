import { devices, expect, test } from "@playwright/test";

import { horizontalOverflow, signIn } from "./helpers";

test.use({ userAgent: devices["Pixel 7"].userAgent, isMobile: true, hasTouch: true });

for (const width of [360, 390, 430]) {
  for (const inset of [0, 24]) {
    test(`bottom bar is flush at ${width}px with ${inset}px safe area`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      // Chromium desktop has no physical system navigation inset. Exercise both geometries.
      await page.addInitScript((px) => {
        addEventListener("DOMContentLoaded", () => {
          document.documentElement.style.setProperty("--safe-bottom", `${px}px`);
        });
      }, inset);
      await signIn(page);
      for (const path of ["/home", "/packages", "/notifications", "/profile"]) {
        await page.goto(path);
        const bar = page.getByRole("navigation");
        await expect(bar).toBeVisible();
        for (const bottom of [false, true]) {
          await page.evaluate((end) => scrollTo(0, end ? document.body.scrollHeight : 0), bottom);
          const geometry = await bar.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            const list = el.querySelector("ul")!.getBoundingClientRect();
            return { bottom: rect.bottom, height: rect.height, inset: rect.bottom - list.bottom };
          });
          expect(geometry).toEqual({ bottom: 844, height: 50 + inset, inset });
          expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
        }
      }
    });
  }
}
