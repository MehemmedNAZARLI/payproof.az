"use client";

import { Chip } from "@/components/ui/chip";
import { t } from "@/lib/i18n";

import { type PackageFilter, packageFilters } from "../filters";

type FilterChipsProps = {
  value: PackageFilter;
  counts?: (filter: PackageFilter) => number;
  onChange: (filter: PackageFilter) => void;
};

// Scrolls sideways inside its own row (bleeding to the screen edges); the page never does.
export function FilterChips({ value, counts, onChange }: FilterChipsProps) {
  return (
    <div
      role="group"
      aria-label={t.packageFilter.label}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {packageFilters.map((f) => (
        <Chip key={f} pressed={value === f} count={counts?.(f)} onClick={() => onChange(f)}>
          {t.packageFilter[f]}
        </Chip>
      ))}
    </div>
  );
}
