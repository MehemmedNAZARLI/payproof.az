import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { BottomSheet } from "./bottom-sheet";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <main>
        <button onClick={() => setOpen(true)}>R-005-ə bax</button>
      </main>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Vahid qiymət uyğunluğu"
        description="R-005 · Uyğunsuz"
        footer={<button onClick={() => setOpen(false)}>Hazırdır</button>}
      >
        <a href="#evidence">Mənbə sübutu</a>
      </BottomSheet>
    </>
  );
}

const openSheet = () => {
  render(<Harness />);
  const trigger = screen.getByRole("button", { name: "R-005-ə bax" });
  trigger.focus();
  fireEvent.click(trigger);
  return { trigger, dialog: screen.getByRole("dialog", { name: "Vahid qiymət uyğunluğu" }) };
};

const closed = () => waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

describe("BottomSheet", () => {
  it("renders nothing while closed", () => {
    render(<Harness />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens as a labelled modal dialog and takes focus", () => {
    const { dialog } = openSheet();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("R-005 · Uyğunsuz");
    expect(dialog).toHaveFocus();
  });

  it("makes the page behind inert while open", async () => {
    openSheet();
    const main = document.querySelector("main")?.parentElement;
    expect(main).toHaveAttribute("inert");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await closed();
    expect(main).not.toHaveAttribute("inert");
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const { dialog, trigger } = openSheet();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await closed();
    expect(trigger).toHaveFocus();
  });

  it("closes from the labelled close button", async () => {
    openSheet();
    fireEvent.click(screen.getByRole("button", { name: "Bağla" }));
    await closed();
  });

  it("closes when the dimmed backdrop is tapped", async () => {
    const { dialog } = openSheet();
    fireEvent.click(dialog.previousElementSibling as Element);
    await closed();
  });

  it("keeps Tab focus inside the sheet", () => {
    const { dialog } = openSheet();
    const close = screen.getByRole("button", { name: "Bağla" });
    const last = screen.getByRole("button", { name: "Hazırdır" });
    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });
});
