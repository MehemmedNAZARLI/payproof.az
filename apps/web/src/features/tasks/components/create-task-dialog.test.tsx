import type { Schemas } from "@payproof/api-client";
import { mockIds } from "@payproof/mocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { setToken } from "@/lib/auth";
import { renderWithQuery } from "@/test/render";
import { CreateTaskDialog } from "./create-task-dialog";

beforeEach(() => setToken(`mock.${mockIds.user("u1")}`));

const pkg = {
  id: mockIds.pkg("pkg_1042"),
  invoice_number: "INV-1042",
  link: { order_po: null, candidates: [{ po_number: "PO-381" }] },
} as unknown as Schemas["PackageDetail"];
const check = {
  rule_id: "R-001",
  title: "Məcburi sifariş nömrəsi (PO)",
  outcome: "FAIL",
  message: "Fakturada PO yoxdur.",
} as unknown as Schemas["CheckResult"];

const open = () => {
  const onOpenChange = vi.fn();
  renderWithQuery(<CreateTaskDialog pkg={pkg} check={check} open onOpenChange={onOpenChange} />);
  return onOpenChange;
};

test("defaults: the rule's usual owner, a step template, a due date in two days", async () => {
  open();
  const who = screen.getByLabelText("Məsul şəxs");
  await waitFor(() => expect(who).toHaveDisplayValue(/Leyla Rzayeva/));
  expect((screen.getByLabelText("Tələb olunan addım") as HTMLTextAreaElement).value).toContain(
    "(PO-381)",
  );
  expect(screen.getByLabelText("Son tarix")).toHaveAttribute("min");
});

test("a short step and a past due date are explained; nothing is sent", async () => {
  const onOpenChange = open();
  await userEvent.clear(screen.getByLabelText("Tələb olunan addım"));
  await userEvent.type(screen.getByLabelText("Tələb olunan addım"), "qısa");
  const due = screen.getByLabelText("Son tarix");
  await userEvent.clear(due);
  await userEvent.type(due, "2020-01-01");
  await userEvent.click(screen.getByRole("button", { name: /Tapşırığı yarat/ }));
  expect(screen.getByText("Addımı ən azı 10 simvolla təsvir edin.")).toBeInTheDocument();
  expect(screen.getByText("Son tarix keçmişdə ola bilməz.")).toBeInTheDocument();
  expect(onOpenChange).not.toHaveBeenCalled();
});

test("creating closes the dialog", async () => {
  const onOpenChange = open();
  await waitFor(() => expect(screen.getByLabelText("Məsul şəxs")).toHaveDisplayValue(/Leyla/));
  await userEvent.click(screen.getByRole("button", { name: /Tapşırığı yarat/ }));
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
});
