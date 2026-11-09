import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cx } from "@/lib/cx";

export function Card({ className, ...rest }: ComponentPropsWithoutRef<"div">) {
  return <div className={cx("bg-surface rounded-lg p-4 shadow-1", className)} {...rest} />;
}

type SectionHeaderProps = { title: string; action?: ReactNode; id?: string };

// Section title above a card or list, with an optional trailing action ("Hamısı").
export function SectionHeader({ title, action, id }: SectionHeaderProps) {
  return (
    <div className="mt-6 mb-2 flex min-h-11 items-end justify-between gap-3 px-1">
      <h2 id={id} className="text-title3 font-bold">
        {title}
      </h2>
      {action}
    </div>
  );
}
