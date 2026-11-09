import { expect, type Page, signIn, test, USERS } from "./fixtures";

const AYGUN = USERS.aygun;

async function enter(page: Page, path: string) {
  await signIn(page, AYGUN, path);
}

test("a task from a failing check: created, taken, sent back by the rule — never resolved by hand", async ({
  page,
}) => {
  await enter(page, "/packages/INV-1042");
  const checks = page.getByRole("region", { name: "Yoxlamalar" });
  const card = checks.getByRole("article", { name: /^R-001/ });
  await card.getByRole("button", { name: "Tapşırıq yarat" }).click();
  const dialog = page.getByRole("dialog", { name: "Düzəliş tapşırığı yarat" });
  await expect(dialog.getByLabel("Məsul şəxs")).toHaveValue(/.+/); // the rule's usual owner
  await dialog.getByRole("button", { name: "Tapşırığı yarat" }).click();
  await expect(dialog).toBeHidden();
  const created = page.getByText(/^T-\d+ yaradıldı: Leyla Rzayeva/);
  await expect(created).toBeVisible();
  const number = (await created.textContent())!.split(" ")[0]!;
  // the card now shows the open task instead of the create button
  await expect(
    card.getByRole("link", { name: new RegExp(`^${number} · Leyla Rzayeva`) }),
  ).toBeVisible();

  // client-side navigation: a full reload would reset the in-browser mock data
  await page
    .getByRole("navigation")
    .getByRole("link", { name: /Tapşırıqlar/ })
    .click();
  const row = page.getByRole("row", { name: new RegExp(number) });
  await row.getByRole("button", { name: "İcraya götür" }).click();
  await expect(page.getByText(`${number} icraya götürüldü.`)).toBeVisible();
  await row.getByRole("button", { name: "Yoxlamaya göndər" }).click();
  // R-001 still fails: the system sends the task back to work instead of resolving it
  await expect(page.getByText(new RegExp(`${number}: R-001 yoxlaması hələ keçmir`))).toBeVisible();
  await expect(row).toContainText("İcrada");
  await expect(page.getByRole("button", { name: /həll et/i })).toHaveCount(0);
});
