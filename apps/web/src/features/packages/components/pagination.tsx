import { ChevronRight, ChevronsLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  shown: number;
  total: number;
  /** Current page cursor (absent on the first page). */
  cursor?: string;
  nextCursor: string | null;
  onPage: (cursor: string | undefined) => void;
}

/**
 * Cursor pagination (the API has no page numbers). The cursor is in the URL, so the browser's Back
 * button is the "previous page"; here only "first" and "next".
 */
export function Pagination({ shown, total, cursor, nextCursor, onPage }: Props) {
  return (
    <nav
      aria-label="Səhifələr"
      className="border-border text-text-3 flex flex-wrap items-center gap-2 border-t px-4 py-3 text-xs"
    >
      {/* no case suffix on the number: Azerbaijani suffixes depend on it (14-ü, 2-si) */}
      <span className="mr-auto">{`Göstərilir: ${shown} / ${total} paket`}</span>
      {cursor && (
        <Button variant="ghost" size="sm" onClick={() => onPage(undefined)}>
          <ChevronsLeft aria-hidden />
          İlk səhifə
        </Button>
      )}
      {nextCursor && (
        <Button variant="outline" size="sm" onClick={() => onPage(nextCursor)}>
          Növbəti səhifə
          <ChevronRight aria-hidden />
        </Button>
      )}
    </nav>
  );
}
