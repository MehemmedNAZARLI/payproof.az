"use client";

import { cx } from "@/lib/cx";
import { t } from "@/lib/i18n";

import { Icon, type IconName } from "./icon";
import { type Toast, toast, type ToastTone, useToasts } from "./toast-store";

const toneIcon: Record<ToastTone, { icon: IconName; color: string }> = {
  success: { icon: "pass", color: "text-success" },
  error: { icon: "fail", color: "text-danger" },
  warning: { icon: "alert", color: "text-warning" },
  info: { icon: "info", color: "text-info" },
};

// Floating capsules under the status bar. Both live regions exist from the start so
// screen readers announce what is added: errors assertively, the rest politely.
export function Toaster() {
  const items = useToasts();
  const region = "flex w-full flex-col items-center gap-2";
  return (
    <div className="px-safe pointer-events-none fixed inset-x-0 top-0 z-60 mx-auto flex max-w-app flex-col gap-2 pt-[calc(var(--safe-top)+var(--sp-2))]">
      <div role="alert" className={region}>
        {items.filter((x) => x.tone === "error").map(item)}
      </div>
      <div role="status" className={region}>
        {items.filter((x) => x.tone !== "error").map(item)}
      </div>
    </div>
  );
}

function item(x: Toast) {
  const tone = toneIcon[x.tone];
  return (
    <div
      key={x.id}
      className={cx(
        "material shadow-3 pointer-events-auto flex w-full items-center gap-3 rounded-xl py-2 pr-1 pl-4",
        x.leaving
          ? "animate-[toast-out_200ms_ease-in_forwards]"
          : "animate-[toast-in_520ms_var(--ease-spring)]",
      )}
    >
      <Icon name={tone.icon} size={22} className={cx("shrink-0", tone.color)} />
      <div className="min-w-0 grow py-1">
        <p className="text-sm font-semibold">{x.title}</p>
        {x.description && <p className="text-text-2 text-xs">{x.description}</p>}
      </div>
      <button
        type="button"
        aria-label={t.common.dismiss}
        onClick={() => toast.dismiss(x.id)}
        className="text-text-3 grid size-11 shrink-0 place-items-center rounded-full active:opacity-50"
      >
        <Icon name="x" size={16} strokeWidth={2.4} />
      </button>
    </div>
  );
}
