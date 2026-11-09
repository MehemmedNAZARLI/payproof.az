import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test, vi } from "vitest";
import { ConfirmDialog } from "./confirm-dialog";

function Harness({ onConfirm }: { onConfirm: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Paketi sil</button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Paket silinsin?"
        description="Bu əməliyyat geri qaytarılmır."
        confirmLabel="Sil"
        onConfirm={onConfirm}
      />
    </>
  );
}

const open = async () => {
  await userEvent.click(screen.getByRole("button", { name: "Paketi sil" }));
  return screen.findByRole("alertdialog", { name: "Paket silinsin?" });
};

test("starts on Cancel, traps focus, Esc closes and returns focus", async () => {
  render(<Harness onConfirm={vi.fn()} />);
  const dialog = await open();
  expect(dialog).toHaveAccessibleDescription("Bu əməliyyat geri qaytarılmır.");
  expect(screen.getByRole("button", { name: "Ləğv et" })).toHaveFocus();

  await userEvent.tab();
  expect(screen.getByRole("button", { name: "Sil" })).toHaveFocus();
  await userEvent.tab(); // wraps around inside the dialog
  expect(screen.getByRole("button", { name: "Ləğv et" })).toHaveFocus();

  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Paketi sil" })).toHaveFocus();
});

test("destructive confirm runs the action and closes", async () => {
  const onConfirm = vi.fn();
  render(<Harness onConfirm={onConfirm} />);
  await open();
  const confirm = screen.getByRole("button", { name: "Sil" });
  expect(confirm).toHaveClass("bg-destructive", "text-destructive-foreground"); // prototype .btn-danger
  await userEvent.click(confirm);
  expect(onConfirm).toHaveBeenCalledOnce();
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
});

test("async confirm: buttons wait without losing focus, a failure keeps the dialog open", async () => {
  let fail!: (e: Error) => void;
  const onConfirm = vi.fn(() => new Promise<void>((_, reject) => (fail = reject)));
  render(<Harness onConfirm={onConfirm} />);
  await open();
  const confirm = screen.getByRole("button", { name: "Sil" });
  await userEvent.click(confirm);
  expect(confirm).toHaveAttribute("aria-disabled", "true");
  expect(screen.getByRole("button", { name: "Ləğv et" })).toHaveAttribute("aria-disabled", "true");
  expect(confirm).toHaveFocus(); // not dropped to <body>
  await userEvent.click(confirm); // ignored while pending
  expect(onConfirm).toHaveBeenCalledOnce();

  fail(new Error("409"));
  await waitFor(() => expect(confirm).toHaveAttribute("aria-disabled", "false"));
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  expect(confirm).toHaveFocus();
});

test("when the opener is gone after confirming, focus goes to the page fallback", async () => {
  function Gone() {
    const [open, setOpen] = useState(false);
    const [row, setRow] = useState(true);
    return (
      <>
        <div tabIndex={-1} data-focus-fallback>
          Siyahı
        </div>
        {row && <button onClick={() => setOpen(true)}>Paketi sil</button>}
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Paket silinsin?"
          description="Bu əməliyyat geri qaytarılmır."
          confirmLabel="Sil"
          onConfirm={() => setRow(false)}
        />
      </>
    );
  }
  render(<Gone />);
  const dialog = await open();
  await userEvent.click(within(dialog).getByRole("button", { name: "Sil" }));
  await waitFor(() => expect(screen.getByText("Siyahı")).toHaveFocus());
});
