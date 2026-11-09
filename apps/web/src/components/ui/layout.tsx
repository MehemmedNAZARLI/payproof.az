import { CircleCheck, CircleX, Info, SearchX, TriangleAlert, type LucideIcon } from "lucide-react";
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Screen title (the page's only h1), prototype `.ph`. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl leading-tight font-bold tracking-tight">{title}</h1>
        {description && <p className="text-text-2 mt-1">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Card section, prototype `.panel`. With a title it becomes a labelled region. */
export function Panel({
  title,
  actions,
  flush = false,
  className,
  children,
}: {
  title?: string;
  actions?: ReactNode;
  /** No inner padding below the header: tables and lists run edge to edge. */
  flush?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={title ? headingId : undefined}
      className={cn(
        "bg-surface border-border shadow-1 min-w-0 rounded-lg border",
        !flush && "p-4",
        className,
      )}
    >
      {title && (
        <div className={cn("flex items-center justify-between gap-2", flush ? "p-4" : "mb-3")}>
          <h2 id={headingId} className="text-lg font-bold">
            {title}
          </h2>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const tones = {
  danger: { box: "bg-danger-bg border-danger/25", icon: "text-danger", Icon: CircleX },
  warning: { box: "bg-warning-bg border-warning/25", icon: "text-warning", Icon: TriangleAlert },
  success: { box: "bg-success-bg border-success/25", icon: "text-success", Icon: CircleCheck },
  brand: { box: "bg-brand-50 border-brand/25", icon: "text-brand", Icon: Info },
  neutral: { box: "bg-surface-2 border-border", icon: "text-text-2", Icon: Info },
} satisfies Record<string, { box: string; icon: string; Icon: LucideIcon }>;

/** Prototype `.banner`. Pass `role="alert"` only for what must interrupt (e.g. a blocked approval). */
export function Banner({
  tone,
  title,
  actions,
  icon,
  children,
  className,
  ...props
}: {
  tone: keyof typeof tones;
  title: ReactNode;
  actions?: ReactNode;
  icon?: LucideIcon;
  children?: ReactNode;
} & Omit<ComponentProps<"div">, "title">) {
  const { box, icon: iconColor, Icon } = tones[tone];
  const Glyph = icon ?? Icon;
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border p-4", box, className)} {...props}>
      <Glyph aria-hidden className={cn("mt-px size-[22px] shrink-0", iconColor)} />
      <div className="min-w-0">
        <p className="text-md font-bold">{title}</p>
        {children && <div className="text-text-2 mt-0.5 text-sm">{children}</div>}
      </div>
      {actions && <div className="ml-auto flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Prototype `.empty`: nothing to show — say why and what to do. */
export function EmptyState({
  title,
  description,
  action,
  icon: Icon = SearchX,
  headingLevel = 2,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
  /** 2 directly under the page h1, 3 inside a Panel. */
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className="text-text-2 flex flex-col items-center gap-2 px-6 py-10 text-center">
      <Icon aria-hidden className="text-text-3 size-10" strokeWidth={1.6} />
      <Heading className="text-text text-lg font-semibold">{title}</Heading>
      {description && <p className="max-w-[360px] text-sm">{description}</p>}
      {action}
    </div>
  );
}
