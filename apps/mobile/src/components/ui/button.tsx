import type { ComponentPropsWithoutRef } from "react";

import { cx } from "@/lib/cx";

import { Icon, type IconName } from "./icon";

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: "primary" | "secondary" | "plain";
  size?: "md" | "lg";
  block?: boolean;
  icon?: IconName;
};

const variants = {
  primary: "bg-brand-600 text-brand-foreground shadow-1",
  secondary: "bg-surface-2 text-brand-700",
  plain: "text-brand-600",
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
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 font-semibold",
        "transition-[transform,opacity] duration-base ease-base active:scale-[0.97] active:opacity-85",
        "disabled:pointer-events-none disabled:opacity-40",
        size === "lg" ? "h-13 text-lg" : "h-11 text-md",
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
