import { expect, type Page, test } from "@playwright/test";

import { signIn, watchErrors } from "./helpers";

// M-04b (ADR-0010): two tabs of one origin share the mock over a BroadcastChannel; a change in
// one reaches the other through its live event stream, without a reload.

const ID = "0193a000-0000-7000-8002-000000001038";
const hero = (page: Page) => page.getByRole("link", { name: /Təsdiqinizi gözləyir/ });

async function approve(page: Page) {
  await page.goto(`/packages/${ID}`);
  await page.getByRole("button", { name: "Sübutlara baxıb təsdiqlə" }).click();
  const sheet = page.getByRole("dialog");
  for (const name of [/Faktura · v1/, /Sifariş · v1/, /Təhvil sənədi · v1/]) {
    await sheet.getByRole("button", { name }).click();
    await expect(sheet.getByRole("region")).toBeVisible();
    await sheet.getByRole("button", { name: "Geri" }).last().click();
  }
  await sheet.getByText(/Cari v1 versiyasının/).click();
  await sheet.getByRole("button", { name: /Təsdiqlə/ }).click();
  await expect(page).toHaveURL(/success$/);
}

test("an approval in one tab shows in the other within 2 s, without a reload", async ({
  context,
}) => {
  const writer = await context.newPage();
  await signIn(writer);
  const watcher = await context.newPage();
  const errors = watchErrors(watcher);
  await watcher.goto("/home");
  await expect(hero(watcher)).toContainText(/2\s*paket/);
  // Survives only if the page is not reloaded.
  await watcher.evaluate(() => ((window as unknown as { marker: number }).marker = 1));

  await approve(writer);

  await expect(hero(watcher)).toContainText(/1\s*paket/, { timeout: 2_000 });
  expect(await watcher.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);
  expect(errors).toEqual([]);
});
