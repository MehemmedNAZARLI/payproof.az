import type { ComponentPropsWithoutRef } from "react";

import { cx } from "@/lib/cx";

import { Icon, type IconName } from "./icon";

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: "primary" | "secondary" | "plain" | "destructive";
  size?: "md" | "lg";
  block?: boolean;
  icon?: IconName;
};

const variants = {
  primary: "bg-accent-fill text-accent-foreground shadow-accent active:bg-accent-press",
  secondary: "bg-accent-soft text-accent-ink",
  plain: "text-accent",
  // iOS draws destructive actions as red text on a plain surface, not a red slab.
  destructive: "bg-surface text-danger-ink shadow-1",
};

export function Button({
  variant = "primary",
  size = "md",
  block,
  icon,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "press inline-flex items-center justify-center gap-2 px-5 font-semibold",
        "disabled:pointer-events-none disabled:opacity-40",
        size === "lg" ? "h-13 rounded-lg text-headline" : "h-11 rounded-md text-subhead",
        block && "w-full",
        variants[variant],
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === "lg" ? 22 : 20} />}
      {children}
    </button>
  );
}
