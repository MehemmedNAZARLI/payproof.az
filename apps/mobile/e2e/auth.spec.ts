import { expect, test } from "@playwright/test";

import { AYGUN, signIn, watchErrors } from "./helpers";

// M-04: one-tap demo login, the route guard and a sign-out that leaves nothing behind.

test("signs in with one tap and greets the approver", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByRole("button", { name: /Rəşad Əliyev/ }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { level: 1, name: /, Rəşad$/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Awaiting your approval/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test("brings a signed-out visitor back to the page they asked for", async ({ page }) => {
  await page.goto("/packages?status=ready");
  await expect(page).toHaveURL("/login?next=%2Fpackages%3Fstatus%3Dready");
  await signIn(page, AYGUN);
  await expect(page).toHaveURL("/packages?status=ready");
  await expect(page.getByRole("button", { name: /^Awaiting approval/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("stays signed in across a reload", async ({ page }) => {
  await signIn(page);
  await page.reload();
  await expect(page).toHaveURL(/\/home$/);
});

test("signs out and clears the session, the Query cache and the runtime caches", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("link", { name: "Packages" }).click();
  await expect(page.getByRole("list", { name: "Packages" })).toBeVisible();
  // The service worker fills its runtime caches (RSC payloads) as the signed-in user browses.
  await expect
    .poll(() =>
      page.evaluate(async () => (await caches.keys()).some((n) => n === "pages-rsc-prefetch")),
    )
    .toBe(true);
  await page.goto("/profile");
  await page.getByRole("button", { name: "Sign out" }).click();
  const sheet = page.getByRole("dialog", { name: "Sign out?" });
  await sheet.getByRole("button", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/\/login$/);
  // Only the public login screen, fetched after sign-out, may be in the runtime caches now.
  const left = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys())
      if (!name.includes("-precache-"))
        for (const r of await (await caches.open(name)).keys()) urls.push(new URL(r.url).pathname);
    return { storage: localStorage.getItem("payproof.session"), urls };
  });
  expect(left.storage).toBeNull();
  expect(
    left.urls.filter(
      (path) =>
        !path.startsWith("/login") && !path.startsWith("/_next/static/") && path !== "/icon.svg",
    ),
  ).toEqual([]);

  await page.goto("/home");
  await expect(page).toHaveURL(/\/login$/);
});

test("shows the operator's permissions without approval", async ({ page }) => {
  await signIn(page, AYGUN);
  await expect(page.getByRole("link", { name: /Awaiting an approver/ })).toBeVisible();
  await page.getByRole("link", { name: "Profile" }).click();
  const approve = page.getByRole("listitem").filter({ hasText: "Approve ready packages" });
  await expect(approve).toContainText("No");
});
