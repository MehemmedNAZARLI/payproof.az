import { expect, test } from "@playwright/test";

// M-02: in mock mode the API is answered inside the page — no MSW service worker, so
// Serwist keeps the only worker on the scope and nothing hits the network.

test("loads /v1/me and /v1/packages from the in-page mock, beside the app's service worker", async ({
  page,
}) => {
  const apiRequests: string[] = [];
  page.on("request", (r) => r.url().includes("/v1/") && apiRequests.push(r.url()));
  await page.goto("/kit");

  await expect(page.getByText("Rəşad Əliyev · Təsdiqçi · A Distribusiya MMC")).toBeVisible();
  await expect(page.getByRole("button", { name: "Hamısı 14" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Paketlər" }).getByRole("listitem")).toHaveCount(4);

  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(new URL(scope).pathname).toBe("/");
  expect(apiRequests).toEqual([]);
});

test("filters through the API", async ({ page }) => {
  await page.goto("/kit");
  await page.getByRole("button", { name: /^Təsdiq gözləyir/ }).click();
  const rows = page.getByRole("list", { name: "Paketlər" }).getByRole("listitem");
  await expect(rows).toHaveCount(2);
  for (const row of await rows.all()) await expect(row).toContainText("Təsdiq gözləyir");
});

test("keeps showing loaded data while offline", async ({ page, context }) => {
  await page.goto("/kit");
  const rows = page.getByRole("list", { name: "Paketlər" }).getByRole("listitem");
  await expect(rows).toHaveCount(4);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Yenilə" }).click();
  await expect(rows).toHaveCount(4);
  await context.setOffline(false);
  await expect(rows).toHaveCount(4);
});
