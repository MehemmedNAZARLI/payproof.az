import { expect, type Page } from "@playwright/test";

export const RASHAD = "Rəşad Əliyev";
export const AYGUN = "Aygün Məmmədova";

/** One-tap demo sign-in from the login screen; lands on home (or the `next` page). */
export async function signIn(page: Page, name = RASHAD) {
  if (!new URL(page.url()).pathname.startsWith("/login")) await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/**
 * A tab of the bottom bar, followed in the app. The mock DB lives in the page (@payproof/mocks), so
 * a reload (`page.goto`) starts again from the fixtures; stay in the app after a write.
 */
export const tabLink = (page: Page, name: "Əsas" | "Paketlər" | "Bildirişlər" | "Profil") =>
  page.getByRole("navigation").getByRole("link", { name: new RegExp(`^${name}`) });

/** Signs out from the profile tab, in the app (keeps the page's mock DB). */
export async function signOutInApp(page: Page) {
  await tabLink(page, "Profil").click();
  await page.getByRole("button", { name: "Hesabdan çıx" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Hesabdan çıx" }).click();
  await expect(page).toHaveURL(/\/login/);
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
