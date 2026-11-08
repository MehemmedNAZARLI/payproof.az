"use client";

import { Icon } from "@/components/ui/icon";
import { t } from "@/lib/i18n";

type SearchFieldProps = { value: string; onChange: (value: string) => void };

// iOS-style search bar: a filled, rounded field with a magnifier and a clear button.
export function SearchField({ value, onChange }: SearchFieldProps) {
  return (
    <div role="search" className="relative">
      <Icon
        name="search"
        size={18}
        strokeWidth={2.2}
        className="text-text-3 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={t.packages.search}
        placeholder={t.packages.searchPlaceholder}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        className="bg-surface-3 placeholder:text-text-3 h-11 w-full rounded-[12px] pr-11 pl-9.5 text-md outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t.packages.clearSearch}
          className="text-text-3 absolute top-0 right-0 grid size-11 place-items-center active:opacity-50"
        >
          <span className="bg-text-3 text-surface grid size-4.5 place-items-center rounded-full">
            <Icon name="x" size={12} strokeWidth={3} />
          </span>
        </button>
      )}
    </div>
  );
}
