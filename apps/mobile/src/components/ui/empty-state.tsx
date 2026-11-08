import type { ReactNode } from "react";

import { Icon, type IconName } from "./icon";

type EmptyStateProps = { icon?: IconName; title: string; description?: string; action?: ReactNode };

export function EmptyState({ icon = "info", title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="bg-surface-2 text-text-3 mb-2 grid size-16 place-items-center rounded-full">
        <Icon name={icon} size={30} strokeWidth={1.6} />
      </span>
      <h3 className="text-headline">{title}</h3>
      {description && (
        <p className="text-text-2 max-w-72 text-footnote leading-snug">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
