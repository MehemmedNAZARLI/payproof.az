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
