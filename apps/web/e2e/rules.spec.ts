import { expect, type Page, signIn, test, type User, USERS } from "./fixtures";

const RESAD = USERS.resad;

async function enter(page: Page, token: User) {
  await signIn(page, token, "/rules");
}

test("approver saves a new rule set: history grows, approved packages are re-checked", async ({
  page,
}) => {
  await enter(page, RESAD);
  const card = page.getByRole("region", { name: "C Restoran Qrupu" });
  await expect(card.getByText("Qayda dəsti v1")).toBeVisible();
  await card.getByRole("switch", { name: /imza tələb olunur/ }).check();
  await card
    .getByLabel("Dəyişikliyin əsaslandırılması")
    .fill("Müştəri noyabrdan imzalı akt tələb edir.");
  await card.getByRole("button", { name: "Yeni versiya kimi təsdiqlə" }).click();
  await expect(
    page.getByText(
      "C Restoran Qrupu: qayda dəsti v2 təsdiqləndi. Əlaqəli paketlər yenidən yoxlandı.",
    ),
  ).toBeVisible();
  await expect(card.getByText("Qayda dəsti v2")).toBeVisible();
  await card.getByText("Versiya tarixçəsi (2)").click();
  await expect(card.getByRole("listitem")).toHaveCount(2);

  // INV-1035 was approved under v1: no longer "ready to send" (client-side nav keeps mock data)
  await page
    .getByRole("navigation")
    .getByRole("link", { name: /Faktura paketləri/ })
    .click();
  await page.getByRole("link", { name: "INV-1035" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("INV-1035");
  await expect(page.getByText(/göndərilməyə hazırdır$/)).toHaveCount(0);
});
