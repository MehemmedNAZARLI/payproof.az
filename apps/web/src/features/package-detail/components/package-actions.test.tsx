import type { Schemas } from "@payproof/api-client";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { PackageActions, type ApprovalActions } from "./package-actions";

const toastWarning = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { warning: toastWarning } }));

const can = { onApprove: vi.fn(), onExport: vi.fn() };
const ui = (
  status: Schemas["PackageStatus"],
  pending = false,
  allowed: Partial<ApprovalActions> = can,
) =>
  render(
    <PackageActions
      status={status}
      recheck={{ onClick: () => {}, pending }}
      approval={{ onReExport: vi.fn(), onReport: vi.fn(), pending: false, ...allowed }}
    />,
  );
const names = () => screen.getAllByRole("button").map((b) => b.textContent);

test.each([
  ["READY_FOR_APPROVAL", "Təsdiqlə"],
  ["APPROVED_READY", "İxrac et"],
  ["EXPORTED", "Manifesti yenidən yüklə"],
] as const)("%s → primary action %s", (status, primary) => {
  ui(status);
  expect(names()).toEqual(["Yenidən yoxla", "Sənəd yüklə", "Daxili hesabat", primary]);
});

test.each(["NEEDS_FIX", "NEEDS_REVIEW", "PROCESSING"] as const)(
  "%s → approval is visibly blocked, with the reason",
  (status) => {
    ui(status);
    const approve = screen.getByRole("button", { name: "Təsdiqlə" });
    expect(approve).toHaveAttribute("aria-disabled", "true");
    expect(approve).toHaveAccessibleDescription(/Bloklayan yoxlamalar var|Sənədlər emal olunur/);
  },
);

test("approver and export roles open their dialogs", async () => {
  ui("READY_FOR_APPROVAL");
  await userEvent.click(screen.getByRole("button", { name: "Təsdiqlə" }));
  expect(can.onApprove).toHaveBeenCalled();
});

test("an operator sees approval closed, focusable and explained — never performed", async () => {
  ui("READY_FOR_APPROVAL", false, {});
  const approve = screen.getByRole("button", { name: "Təsdiqlə" });
  expect(approve).toHaveAttribute("aria-disabled", "true");
  expect(approve).not.toBeDisabled(); // stays in the tab order, so the reason can be read
  await userEvent.click(approve);
  expect(toastWarning).toHaveBeenCalledWith("Hazır paketi yalnız təsdiqçi təsdiqləyə bilər.");
});

test("re-check shows its progress", () => {
  ui("NEEDS_FIX", true);
  expect(screen.getByRole("button", { name: "Yoxlanılır…" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
});
