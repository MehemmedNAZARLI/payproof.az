import { useRef } from "react";

const fallback = () => document.querySelector<HTMLElement>("[data-focus-fallback]");

/** After an action removed the focused control (e.g. its row left the list): go to the fallback. */
export function keepFocusOnPage() {
  requestAnimationFrame(() => {
    if (!document.activeElement || document.activeElement === document.body) fallback()?.focus();
  });
}

/**
 * For Radix dialogs opened from state instead of a Trigger: remember what had focus when the
 * dialog opened and return focus there on close (Radix can't know the opener).
 * Spread onto `Dialog.Content` / `AlertDialog.Content`.
 */
export function useRestoreFocus() {
  const opener = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: () => {
      opener.current = document.activeElement as HTMLElement | null;
    },
    onCloseAutoFocus: (event: Event) => {
      event.preventDefault();
      // the opener may be gone (e.g. its row was deleted): go to the page's marked fallback
      (opener.current?.isConnected ? opener.current : fallback())?.focus();
    },
  };
}
