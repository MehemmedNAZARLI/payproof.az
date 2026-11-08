import { expect, test } from "@playwright/test";

// The M-03 component preview in a production build, on the iPhone 13 profile.

// Tab screens arrive in M-04…M-10; until then their link prefetches are the only expected 404s.
const UNBUILT_TABS = ["/home", "/packages", "/notifications", "/profile"];

test("renders the kit without console errors or horizontal scroll", async ({ page }) => {
  const errors: string[] = [];
  const missing = new Set<string>();
  page.on("response", (r) => r.status() === 404 && missing.add(new URL(r.url()).pathname));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("status of 404")) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/kit");
    await expect(page.getByRole("heading", { level: 1, name: "UI dəsti" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  }
  expect(errors).toEqual([]);
  expect([...missing].filter((path) => !UNBUILT_TABS.includes(path))).toEqual([]);
});

test("collapses the large title into the bar on scroll", async ({ page }) => {
  await page.goto("/kit");
  const bar = page.getByRole("banner");
  await expect(bar).toHaveCSS("--p", "0");
  await page.mouse.wheel(0, 400);
  await expect(bar).toHaveCSS("--p", "1");
});

test("opens the sheet, closes it with Esc and returns focus", async ({ page }) => {
  await page.goto("/kit");
  const row = page.getByRole("button", { name: /Vahid qiymət uyğunluğu/ });
  await row.click();
  const sheet = page.getByRole("dialog", { name: "Vahid qiymət uyğunluğu" });
  await expect(sheet).toBeInViewport({ ratio: 0.99 });
  await expect(page.locator("nav[inert], [inert] nav")).toHaveCount(1); // page behind is inert
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(row).toBeFocused();
});

test("dismisses the sheet with a downward swipe", async ({ page }) => {
  await page.goto("/kit");
  await page.getByRole("button", { name: /Vahid qiymət uyğunluğu/ }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeInViewport({ ratio: 0.99 });
  const handle = await sheet.locator("[data-sheet-handle]").boundingBox();
  if (!handle) throw new Error("no sheet handle");
  const x = handle.x + handle.width / 2;
  await page.mouse.move(x, handle.y + 10);
  await page.mouse.down();
  for (let y = 20; y <= 260; y += 40) await page.mouse.move(x, handle.y + y);
  await page.mouse.up();
  await expect(sheet).toHaveCount(0);
});

test("keeps bar and sheet controls at least 44×44", async ({ page }) => {
  await page.goto("/kit");
  const targets = [
    ...(await page.getByRole("navigation").getByRole("link").all()),
    page.getByRole("button", { name: /Bildirişlər, 3 oxunmamış/ }),
  ];
  for (const target of targets) {
    const box = await target.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});
