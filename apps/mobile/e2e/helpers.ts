import { expect, type Page } from "@playwright/test";

export const RASHAD = "Rəşad Əliyev";
export const AYGUN = "Aygün Məmmədova";

/** One-tap demo sign-in from the login screen; lands on home (or the `next` page). */
export async function signIn(page: Page, name = RASHAD) {
  if (!new URL(page.url()).pathname.startsWith("/login")) await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Collects console errors and uncaught exceptions; expect it to be empty at the end. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

export const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

/** A one-finger downward drag from `fromY` (CSS px), as a phone sends it (CDP touch events). */
export async function pullDown(page: Page, distance = 240, fromY = 220) {
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", y?: number) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: y === undefined ? [] : [{ x: 195, y }],
    });
  await touch("touchStart", fromY);
  for (let y = fromY + 10; y <= fromY + distance; y += 10) await touch("touchMove", y);
  await touch("touchEnd");
  await cdp.detach();
}
