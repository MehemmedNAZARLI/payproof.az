"use client";

import { type KeyboardEvent, type RefObject, useEffect } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// While `active`: page behind is inert (VoiceOver stays in the dialog), page scroll is locked,
// focus starts on the panel; afterwards focus returns to whatever opened it.
export function useModalFocus(panelRef: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    const panel = panelRef.current;
    if (!active || !panel) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const layer = [...document.body.children].find((el) => el.contains(panel));
    const hidden = [...document.body.children].filter(
      (el) => el !== layer && !el.hasAttribute("inert"),
    );
    hidden.forEach((el) => el.setAttribute("inert", ""));
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = "hidden";
    panel.focus();
    return () => {
      hidden.forEach((el) => el.removeAttribute("inert"));
      html.style.overflow = overflow;
      previous?.focus();
    };
  }, [panelRef, active]);
}

// Esc closes; Tab and Shift+Tab cycle inside the panel.
export function trapKeys(e: KeyboardEvent<HTMLElement>, onClose: () => void) {
  if (e.key === "Escape") {
    e.stopPropagation();
    onClose();
    return;
  }
  if (e.key !== "Tab") return;
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const first = items[0];
  const last = items.at(-1);
  if (!first || !last) {
    e.preventDefault();
    return;
  }
  const current = document.activeElement;
  if (e.shiftKey && (current === first || current === e.currentTarget)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && current === last) {
    e.preventDefault();
    first.focus();
  }
}
