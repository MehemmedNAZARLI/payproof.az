import { cx } from "@/lib/cx";
import { t } from "@/lib/i18n";

// Placeholder block with a moving highlight; size it with classes (`h-4 w-1/2`).
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cx("shimmer block rounded-sm", className)} />;
}

// Loading stand-in for a "cards" list; announced once as a busy status, rows stay silent.
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-2">
      <span className="sr-only">{t.common.loading}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="bg-surface flex min-h-14 flex-col gap-2 rounded-lg px-4 py-3 shadow-1"
        >
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-3/5" />
          <Skeleton className="h-5 w-1/3 rounded-full" />
        </div>
      ))}
    </div>
  );
}
