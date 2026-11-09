import { expect, test } from "./fixtures";

test("dev login: pick a demo user, /v1/me drives the app", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByText("Rəşad Əliyev").click(); // the label: the radio itself is visually hidden
  await expect(page.getByRole("radio", { name: /Rəşad Əliyev/ })).toBeChecked();
  await page.getByRole("button", { name: "Daxil ol" }).click();

  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByRole("heading", { name: "İcmal" })).toBeVisible();
  await expect(page.getByText("Rəşad Əliyev kimi daxil oldunuz.")).toBeVisible();

  // Reload keeps the session (sessionStorage).
  await page.reload();
  await expect(page.getByRole("heading", { name: "İcmal" })).toBeVisible();
});

test("an expired session (401) returns to the login screen", async ({ page }) => {
  await page.goto("/login");
  await page.evaluate(() => sessionStorage.setItem("payproof.token", "mock.expired"));
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Sessiya bitib. Yenidən daxil olun.")).toBeVisible();
});
