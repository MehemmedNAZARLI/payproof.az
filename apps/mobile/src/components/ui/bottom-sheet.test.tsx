import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { BottomSheet } from "./bottom-sheet";
import { Toaster } from "./toaster";

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

  it("closes on Escape even when focus has fallen back to the page body", async () => {
    openSheet();
    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(document.body, { key: "Escape" });
    await closed();
  });

  it("leaves toasts usable while open", () => {
    render(<Toaster />);
    openSheet();
    expect(screen.getByRole("alert").closest("[inert]")).toBeNull();
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

describe("BottomSheet swipe-down", () => {
  const swipe = (handle: Element, dy: number) => {
    fireEvent.pointerDown(handle, { pointerId: 1, isPrimary: true, button: 0, clientY: 100 });
    fireEvent.pointerMove(handle, { pointerId: 1, isPrimary: true, clientY: 100 + dy / 2 });
    fireEvent.pointerMove(handle, { pointerId: 1, isPrimary: true, clientY: 100 + dy });
    fireEvent.pointerUp(handle, { pointerId: 1, isPrimary: true, clientY: 100 + dy });
  };
  const handleOf = (dialog: HTMLElement) => dialog.querySelector("[data-sheet-handle]") as Element;

  it("dismisses when dragged down", async () => {
    const { dialog } = openSheet();
    swipe(handleOf(dialog), 300);
    await closed();
  });

  it("stretches a little when pulled upwards, then springs back", async () => {
    const { dialog } = openSheet();
    const handle = handleOf(dialog);
    fireEvent.pointerDown(handle, { pointerId: 1, isPrimary: true, button: 0, clientY: 300 });
    fireEvent.pointerMove(handle, { pointerId: 1, isPrimary: true, clientY: 100 });
    const stretched = Number(/, (-?[\d.]+)px/.exec(dialog.style.transform)?.[1]);
    expect(stretched).toBeLessThan(0);
    expect(stretched).toBeGreaterThan(-64);
    fireEvent.pointerUp(handle, { pointerId: 1, isPrimary: true, clientY: 100 });
    await waitFor(() => expect(dialog.style.transform).toBe("translate3d(0px, 0px, 0px)"));
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("treats a tap on the close button as a tap, not a drag", async () => {
    openSheet();
    const close = screen.getByRole("button", { name: "Bağla" });
    fireEvent.pointerDown(close, { pointerId: 1, isPrimary: true, button: 0, clientY: 50 });
    fireEvent.pointerUp(close, { pointerId: 1, isPrimary: true, clientY: 51 });
    fireEvent.click(close);
    await closed();
  });

  it("ignores a grab while the sheet is already closing", async () => {
    const { dialog } = openSheet();
    fireEvent.click(screen.getByRole("button", { name: "Bağla" }));
    swipe(handleOf(dialog), -80);
    await closed();
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("settles back when its owner keeps it open after a swipe", async () => {
    render(
      <BottomSheet open onClose={() => {}} title="Təsdiq göndərilir">
        <p>…</p>
      </BottomSheet>,
    );
    const dialog = screen.getByRole("dialog");
    swipe(handleOf(dialog), 300);
    await waitFor(() => expect(dialog.style.transform).toBe("translate3d(0px, 0px, 0px)"));
  });
});
