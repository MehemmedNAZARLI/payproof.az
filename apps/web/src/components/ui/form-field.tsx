import { useId, type ReactNode } from "react";

/** The control style that goes with Field (44px tall on touch). */
export const fieldInput =
  "border-border-strong bg-surface focus-visible:ring-ring w-full rounded-md border px-3 py-2 outline-none focus-visible:ring-2 aria-invalid:border-danger pointer-coarse:min-h-11";

/**
 * Label + control + error (or hint), wired for screen readers: the render prop gets the control
 * id and what describes it. Errors replace the hint so only one message is read.
 */
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string | null;
  hint?: string;
  children: (id: string, describedBy?: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children(id, error ? `${id}-err` : hint ? `${id}-hint` : undefined)}
      {error ? (
        <p id={`${id}-err`} className="text-danger text-sm">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-text-3 text-xs">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
