import { expect, REAL, signIn, test, USERS } from "./fixtures";
import { API_URL } from "./stack";

const AYGUN = USERS.aygun;
// mock mode: MSW answers any origin
const API = REAL ? API_URL : "http://localhost:8000";

test("all 14 demo packages open without errors", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await signIn(page, AYGUN, "/packages");
  await expect(
    page.getByRole("table", { name: "Faktura paketləri" }).locator("tbody tr"),
  ).toHaveCount(14);
  const packages = await page.evaluate(
    async (api) =>
      (
        await (
          await fetch(`${api}/v1/packages`, {
            headers: { Authorization: `Bearer ${sessionStorage.getItem("payproof.token")}` },
          })
        ).json()
      ).items as { id: string; status: string; invoice_number: string | null }[],
    API,
  );
  expect(packages).toHaveLength(14);

  for (const p of packages) {
    await page.goto(`/packages/${p.id}`);
    await expect(
      page.getByRole("heading", { level: 1, name: p.invoice_number ?? "Emal olunur…" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Fəaliyyət tarixçəsi" }).getByRole("listitem").first(),
    ).toBeVisible();
    if (p.status === "PROCESSING") {
      await expect(page.getByRole("region", { name: "Sənədlər emal olunur" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Sənədlər və versiyalar" })).toHaveCount(0);
    } else {
      await expect(page.getByRole("region", { name: "Sənədlər və versiyalar" })).toBeVisible();
    }
  }
  expect(errors).toEqual([]);
});

test("a row in the list opens the detail page", async ({ page }) => {
  await signIn(page, AYGUN, "/packages?q=INV-1042");
  await page.getByRole("link", { name: "INV-1042" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "INV-1042" })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Yol" })
    .getByRole("link", { name: "Faktura paketləri" })
    .click();
  await expect(page).toHaveURL(/\/packages$/);
});
