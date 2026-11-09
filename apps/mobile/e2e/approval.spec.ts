import { expect, type Page, test } from "@playwright/test";

import { AYGUN, horizontalOverflow, signIn, tabLink, watchErrors } from "./helpers";

// M-09 approval on the iPhone 13 profile: review gate, one approval, success, every view updated.

const ID = "0193a000-0000-7000-8002-000000001038";
const sheetOf = (page: Page) => page.getByRole("dialog", { name: "INV-1038 — approve package" });
const confirm = (page: Page) => sheetOf(page).getByRole("button", { name: /Approve/ });

async function review(page: Page) {
  const sheet = sheetOf(page);
  for (const name of [/Invoice · v1/, /Order · v1/, /Delivery document · v1/]) {
    await sheet.getByRole("button", { name }).click();
    await expect(page.getByRole("dialog").getByRole("region")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Back" }).last().click();
    await expect(sheet).toBeVisible();
  }
  await expect(sheet.getByText("3/3 reviewed")).toBeVisible();
}

test("reviews every document, approves once and shows it everywhere", async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);
  await expect(page.getByRole("link", { name: /Awaiting your approval/ })).toContainText(
    /2\s*packages/,
  );
  await page.goto(`/packages/${ID}`);
  await page.getByRole("button", { name: "Review evidence and approve" }).click();

  await expect(confirm(page)).toHaveAttribute("aria-disabled", "true");
  await expect(sheetOf(page).getByRole("checkbox")).toBeDisabled();
  await expect(confirm(page)).toBeInViewport();
  await confirm(page).click({ force: true });
  await expect(page).toHaveURL(new RegExp(`${ID}$`));

  await review(page);
  await sheetOf(page)
    .getByText(/I reviewed the documents and check results for v1/)
    .click();
  await expect(confirm(page)).not.toHaveAttribute("aria-disabled");
  await confirm(page).dblclick();

  await expect(page).toHaveURL(`/packages/${ID}/success`);
  await expect(page.getByRole("heading", { name: "Package ready to send" })).toBeFocused();
  await expect(page.getByText(/4\.860,00 AZN invoice package \(INV-1038, v1\)/)).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

  await page.getByRole("link", { name: "Back to home" }).click();
  await expect(page.getByRole("link", { name: /Awaiting your approval/ })).toContainText(
    /1\s*packages/,
  );
  // In the app from here on: the mock DB lives in the page, a reload would start it afresh.
  await page
    .getByRole("list", { name: "Statuses" })
    .getByRole("link", { name: /Ready to send/ })
    .click();
  await expect(page).toHaveURL("/packages?status=approved");
  await page.getByRole("link", { name: /INV-1038/ }).click();
  await expect(page.getByRole("link", { name: "Export on web" })).toBeVisible();
  await expect(page.getByText(/Approved by:\s*Rəşad Əliyev/)).toBeVisible();
  // A double tap made one approval: the activity feed has one new approval event.
  await page.goBack();
  await tabLink(page, "Home").click();
  await expect(page.getByText(/Package approved · INV-1038/)).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("an operator sees no approval, only who it waits for", async ({ page }) => {
  await signIn(page, AYGUN);
  await page.goto(`/packages/${ID}`);
  await expect(page.getByText("Awaiting approver")).toBeVisible();
  await expect(page.getByRole("button", { name: "Review evidence and approve" })).toHaveCount(0);
});

test("approval says plainly that it needs a connection", async ({ page, context }) => {
  await signIn(page);
  await page.goto(`/packages/${ID}`);
  await page.getByRole("button", { name: "Review evidence and approve" }).click();
  await context.setOffline(true);
  await expect(sheetOf(page).getByRole("alert")).toContainText(
    "Approval requires you to be online",
  );
  await expect(confirm(page)).toHaveAttribute("aria-disabled", "true");
  await context.setOffline(false);
  await expect(sheetOf(page).getByRole("alert")).toHaveCount(0);
});

test("ticking the acknowledgement on a phone on its side keeps the sheet in place", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await signIn(page);
  await page.goto(`/packages/${ID}`);
  await page.getByRole("button", { name: "Review evidence and approve" }).click();
  await review(page);
  await sheetOf(page)
    .getByText(/I reviewed the documents and check results for v1/)
    .click();
  // Focus on the visually hidden checkbox must not scroll the panel itself off screen.
  expect(await sheetOf(page).evaluate((d) => d.scrollTop)).toBe(0);
  await expect(confirm(page)).toBeInViewport();
});
