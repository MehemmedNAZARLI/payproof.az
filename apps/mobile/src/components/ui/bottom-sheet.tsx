"use client";

import { type ReactNode, useId, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { t } from "@/lib/i18n";

import { Icon } from "./icon";
import { trapKeys, useModalFocus } from "./use-modal-focus";
import { useSheetDrag } from "./use-sheet-drag";
import { useSheetMotion } from "./use-sheet-motion";

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
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
}: BottomSheetProps) {
  const motion = useSheetMotion(open);
  const dragHandlers = useSheetDrag(motion, onClose);
  const { present, sheetRef, backdropRef } = motion;
  useModalFocus(sheetRef, present);
  const titleId = useId();
  const descId = useId();
  if (!useIsClient() || !present) return null;

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
        onKeyDown={(e) => trapKeys(e, onClose)}
        className="bg-surface shadow-3 absolute inset-x-0 bottom-0 mx-auto flex max-h-[calc(100dvh-var(--safe-top)-var(--sp-3))] max-w-app flex-col rounded-t-(--sheet-radius) outline-none will-change-transform"
      >
        <div data-sheet-handle className="flex-none touch-none" {...dragHandlers}>
          <div
            aria-hidden="true"
            className="bg-border-strong mx-auto mt-2 mb-1 h-1.25 w-9 rounded-full"
          />
          <div className="flex items-start gap-3 pt-2 pr-3 pb-3 pl-5">
            <div className="min-w-0 grow pt-1">
              <h2 id={titleId} className="text-xl leading-tight font-bold">
                {title}
              </h2>
              {description && (
                <p id={descId} className="text-text-3 mt-0.5 text-sm">
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
        <div className="min-h-0 grow overflow-y-auto overscroll-contain px-5 pb-3">{children}</div>
        {footer && <div className="hairline-t flex flex-none gap-2 px-5 pt-3">{footer}</div>}
        <div className="pb-safe min-h-4 flex-none" />
      </div>
    </div>,
    document.body,
  );
}
