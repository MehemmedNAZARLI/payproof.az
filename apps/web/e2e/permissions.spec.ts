import { expect, signIn, test, USERS } from "./fixtures";

const pkg = (n: number) => `/packages/INV-${n}`;

test("INV-1048: the operator picks one of two candidates and confirms the link", async ({
  page,
}) => {
  await signIn(page, USERS.aygun, pkg(1048));
  await page
    .getByRole("region", { name: "Yoxlamalar", exact: true })
    .getByRole("button", { name: "Sifarişi seç" })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "INV-1048: sifarişi seçin və təsdiqləyin" });
  const options = dialog.getByRole("radio");
  await expect(options).toHaveCount(2); // the AI suggests, a person decides
  const po = (await dialog.locator("label").first().locator("b").textContent())!;
  await options.first().check({ force: true });
  await dialog.getByRole("button", { name: "Seçilmiş sifarişlə əlaqəni təsdiqlə" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(new RegExp(`^${po} ilə əlaqə təsdiqləndi\\.`))).toBeVisible();
});

test.describe("read-only auditor (Kamran)", () => {
  test("package detail: every change is visibly closed and explained", async ({ page }) => {
    await signIn(page, USERS.kamran, pkg(1042));
    await expect(page.getByRole("heading", { level: 1, name: "INV-1042" })).toBeVisible();
    for (const name of ["Sənəd yüklə", "Təsdiqlə", "Tapşırıq yarat"]) {
      const buttons = await page.getByRole("button", { name, exact: true }).all();
      expect(buttons.length, name).toBeGreaterThan(0); // present, not hidden
      for (const b of buttons) {
        await expect(b).toHaveAttribute("aria-disabled", "true");
        await expect(b).toHaveAttribute("title", /.+/); // the reason is readable
      }
    }
    await expect(page.getByRole("button", { name: "Paketi sil" })).toHaveCount(0);
    // reading stays open: the internal report can still be downloaded
    await expect(page.getByRole("button", { name: "Daxili hesabat" })).toBeEnabled();
  });

  test("lists, tasks and rules offer no changes", async ({ page }) => {
    await signIn(page, USERS.kamran, "/packages");
    await expect(page.getByRole("table", { name: "Faktura paketləri" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Yeni paket" })).toHaveCount(0);

    await page
      .getByRole("navigation")
      .getByRole("link", { name: /Tapşırıqlar/ })
      .click();
    await expect(page.getByRole("table", { name: "Tapşırıqlar" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /İcraya götür|Yoxlamaya göndər|ləğv et/ }),
    ).toHaveCount(0);

    await page.getByRole("navigation").getByRole("link", { name: "Müştəri qaydaları" }).click();
    const save = page.getByRole("button", { name: "Yeni versiya kimi təsdiqlə" }).first();
    await expect(save).toHaveAttribute("aria-disabled", "true");
  });
});
