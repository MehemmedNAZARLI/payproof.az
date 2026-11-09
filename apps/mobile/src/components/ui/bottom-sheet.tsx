"use client";

import { type ReactNode, useId, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { cx } from "@/lib/cx";
import { t } from "@/lib/i18n";

import { Icon } from "./icon";
import { useHeightMorph, usePageFocus } from "./use-height-morph";
import { trapTab, useModalFocus } from "./use-modal-focus";
import { useSheetDrag } from "./use-sheet-drag";
import { useSheetMotion } from "./use-sheet-motion";

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** "large": a reading surface (documents) — tall, and the whole screen on a phone on its side. */
  size?: "auto" | "large";
  /** Before the title, e.g. a back button between pages of the sheet. */
  leading?: ReactNode;
  /** Identifies the page shown; a new value slides the page in and morphs the height. */
  page?: string;
  /** Which way the new page arrives: deeper ("push") or back ("pop"). */
  direction?: "push" | "pop";
  /** Drop the footer when the screen is short (landscape phone); the header must cover it. */
  hideFooterWhenShort?: boolean;
};

const noop = () => () => {};
const useIsClient = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

export function BottomSheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "auto",
  leading,
  page,
  direction = "push",
  hideFooterWhenShort = false,
}: BottomSheetProps) {
  const motion = useSheetMotion(open);
  const dragHandlers = useSheetDrag(motion, onClose);
  const { present, sheetRef, backdropRef } = motion;
  // After hydration the portal mounts one render later; only then is there a panel to manage.
  const isClient = useIsClient();
  useModalFocus(sheetRef, present && isClient, onClose);
  const titleId = useId();
  const descId = useId();
  useHeightMorph(sheetRef, page);
  usePageFocus(sheetRef, page);
  if (!isClient || !present) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        ref={backdropRef}
        aria-hidden="true"
        onClick={onClose}
        className="bg-overlay absolute inset-0 opacity-0"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        // Off-screen until the spring takes over; React leaves it alone while the value is unchanged.
        style={{ transform: "translate3d(0, 100%, 0)" }}
        onKeyDown={trapTab}
        className={cx(
          "bg-surface shadow-3 absolute inset-x-0 bottom-0 mx-auto flex max-h-[calc(100dvh-var(--safe-top)-var(--sp-3))] max-w-app flex-col overflow-clip-safe rounded-t-(--sheet-radius) outline-none will-change-transform",
          size === "large" && "short:h-dvh short:max-h-dvh short:max-w-none short:rounded-t-xl",
        )}
      >
        <div data-sheet-handle className="flex-none touch-none" {...dragHandlers}>
          <div
            aria-hidden="true"
            className="bg-separator mx-auto mt-2 mb-1 h-1.25 w-9 rounded-full"
          />
          <div
            className={cx(
              "flex items-start gap-3 pt-2 pr-3 pb-3 pl-5",
              size === "large" && "short:pb-2",
            )}
          >
            {leading}
            <div className="min-w-0 grow pt-1">
              <h2 id={titleId} className="text-title3 font-bold">
                {title}
              </h2>
              {description && (
                <p id={descId} className="text-text-3 mt-0.5 text-footnote">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label={t.common.close}
              onClick={onClose}
              className="bg-surface-2 text-text-2 relative mt-1 grid size-8 flex-none place-items-center rounded-full before:absolute before:-inset-1.5 active:opacity-60"
            >
              <Icon name="x" size={16} strokeWidth={2.6} />
            </button>
          </div>
        </div>
        <div
          key={page}
          data-sheet-page
          style={
            page
              ? { animation: `sheet-${direction} 380ms cubic-bezier(0.32, 0.72, 0, 1)` }
              : undefined
          }
          className={cx(
            "min-h-0 grow overflow-y-auto overscroll-contain px-5 pb-3",
            size === "large" && "short:pr-safe short:pl-safe short:pb-safe",
          )}
        >
          {children}
        </div>
        {footer && (
          <div
            className={cx(
              "hairline-t flex flex-none gap-2 px-5 pt-3 pb-[max(var(--safe-bottom),var(--sp-4))]",
              hideFooterWhenShort && "short:hidden",
            )}
          >
            {footer}
          </div>
        )}
        {!footer && (
          <div className={cx("pb-safe min-h-4 flex-none", size === "large" && "short:hidden")} />
        )}
      </div>
    </div>,
    document.body,
  );
}
