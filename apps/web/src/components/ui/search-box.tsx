"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  placeholder: string;
  /** The committed value (from the URL). */
  value: string;
  /** Called once typing pauses, with the trimmed text. */
  onSearch: (q: string) => void;
  delayMs?: number;
  className?: string;
}

/** Debounced search field that follows `value` when it changes elsewhere (Back button, "clear"). */
export function SearchBox({
  label,
  placeholder,
  value,
  onSearch,
  delayMs = 300,
  className,
}: Props) {
  const [text, setText] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setText(value);
  }
  // The timer must call the latest onSearch: it closes over the latest filters (no stale URL state).
  const latest = useRef(onSearch);
  useEffect(() => {
    latest.current = onSearch;
  });
  useEffect(() => {
    if (text.trim() === value) return;
    const timer = setTimeout(() => latest.current(text.trim()), delayMs);
    return () => clearTimeout(timer);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps -- only typing starts the debounce

  return (
    <label
      className={cn(
        "border-border-strong bg-surface focus-within:ring-ring flex h-10 items-center gap-2 rounded-md border px-3 focus-within:ring-2 pointer-coarse:h-11",
        className,
      )}
    >
      <Search aria-hidden className="text-text-3 size-4 shrink-0" />
      <input
        type="search"
        aria-label={label}
        value={text}
        maxLength={100}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="placeholder:text-text-3 h-full w-full min-w-0 bg-transparent outline-none"
      />
    </label>
  );
}
