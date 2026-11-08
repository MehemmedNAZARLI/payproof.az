import { cx } from "@/lib/cx";

import { Icon } from "./icon";

// The prototype's five avatar tones; literal classes so Tailwind keeps them.
const tones = [
  "bg-avatar-1 text-avatar-1-text",
  "bg-avatar-2 text-avatar-2-text",
  "bg-avatar-3 text-avatar-3-text",
  "bg-avatar-4 text-avatar-4-text",
  "bg-avatar-5 text-avatar-5-text",
] as const;

const sizes = { sm: "size-8 text-xs", md: "size-11 text-[15px]", lg: "size-16 text-[22px]" };

/** A stable tone per user id, so a person keeps one colour across screens. */
export function avatarTone(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % tones.length;
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("az"))
    .join("");

type AvatarProps = {
  /** null: the system (rule engine, extraction), shown with a sparkle instead of initials. */
  user: { id: string; full_name: string } | null;
  size?: keyof typeof sizes;
  className?: string;
};

// Decorative: the name is always next to it, so screen readers skip the initials.
export function Avatar({ user, size = "sm", className }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-grid shrink-0 place-items-center rounded-full font-bold tracking-tight select-none",
        sizes[size],
        user ? tones[avatarTone(user.id)] : "bg-surface-2 text-text-2",
        className,
      )}
    >
      {user ? initials(user.full_name) : <Icon name="sparkle" size={size === "sm" ? 16 : 22} />}
    </span>
  );
}
