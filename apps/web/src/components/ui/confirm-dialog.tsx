"use client";

import { actionLabel } from "@payproof/api-client/i18n";
import { AlertDialog } from "radix-ui";
import { useState, type MouseEvent, type ReactNode } from "react";
import { Button } from "./button";
import { useRestoreFocus } from "./restore-focus";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  /**
   * May return a promise: the dialog stays open (buttons inert) until it settles, and on failure.
   * Errors are not shown here — pass a mutation (`mutateAsync`) so the global handler toasts them.
   */
  onConfirm: () => void | Promise<void>;
  /** false for non-destructive confirmations (primary button). */
  destructive?: boolean;
}

/**
 * Confirmation for destructive actions (prototype `confirmModal`). Radix AlertDialog: focus trap,
 * Esc, focus returns to the opener; initial focus is on "Ləğv et" so Enter never destroys by accident.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive = true,
}: Props) {
  const [pending, setPending] = useState(false);
  const focus = useRestoreFocus(); // opened from state, not an AlertDialog.Trigger

  const confirm = async (event: MouseEvent) => {
    event.preventDefault(); // close only after the action succeeds
    if (pending) return;
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // the query client's global handler already shows the error; keep the dialog for a retry
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => pending || onOpenChange(next)}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="bg-overlay fixed inset-0 z-50" />
        <AlertDialog.Content
          {...focus}
          className="bg-surface border-border shadow-3 fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[min(560px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border"
        >
          <div className="px-6 pt-5 pb-3">
            <AlertDialog.Title className="text-xl leading-snug font-semibold">
              {title}
            </AlertDialog.Title>
          </div>
          <AlertDialog.Description asChild>
            <div className="text-text-2 overflow-auto px-6 pb-5">{description}</div>
          </AlertDialog.Description>
          <div className="border-border flex flex-wrap justify-end gap-2 border-t px-6 py-4">
            <AlertDialog.Cancel asChild>
              <Button
                variant="outline"
                size="lg"
                aria-disabled={pending}
                className="aria-disabled:cursor-wait aria-disabled:opacity-50"
              >
                {actionLabel.cancel}
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                variant={destructive ? "destructive" : "default"}
                size="lg"
                aria-disabled={pending}
                className="aria-disabled:cursor-wait aria-disabled:opacity-50"
                onClick={confirm}
              >
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
