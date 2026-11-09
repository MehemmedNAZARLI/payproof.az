import { ui } from "@payproof/api-client/i18n";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A bare placeholder shape. Compose several inside one `Loading`. */
export const SkeletonBar = ({ className }: { className?: string }) => (
  <div
    data-skeleton
    className={cn("bg-surface-3 motion-safe:animate-pulse rounded-sm", className)}
  />
);

/**
 * One loading announcement per screen area: live regions read their text, so it is real (sr-only)
 * content; the placeholder shapes inside are decorative.
 */
export function Loading({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div role="status" className={className}>
      <span className="sr-only">{ui.loading}</span>
      <div aria-hidden="true" className="contents">
        {children}
      </div>
    </div>
  );
}

/** A block of any size: `<Skeleton className="h-24 w-full" />`. */
export const Skeleton = ({ className }: { className?: string }) => (
  <Loading>
    <SkeletonBar className={className} />
  </Loading>
);

/** Paragraph-like lines; the last one is shorter. */
export const SkeletonText = ({ lines = 3, className }: { lines?: number; className?: string }) => (
  <Loading className={cn("flex flex-col gap-2", className)}>
    {Array.from({ length: lines }, (_, i) => (
      <SkeletonBar
        key={i}
        className={cn("h-4", i === lines - 1 && lines > 1 ? "w-3/5" : "w-full")}
      />
    ))}
  </Loading>
);

/** Table body placeholder for list screens. */
export const SkeletonTable = ({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) => (
  <Loading className="flex flex-col">
    {Array.from({ length: rows }, (_, r) => (
      <div key={r} className="border-border flex gap-4 border-b px-4 py-3 last:border-b-0">
        {Array.from({ length: columns }, (_, c) => (
          <SkeletonBar key={c} className={cn("h-4", c === 0 ? "w-1/4" : "flex-1")} />
        ))}
      </div>
    ))}
  </Loading>
);
