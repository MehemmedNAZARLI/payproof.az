import type { Config } from "tailwindcss";

// Every value points at a CSS variable from tokens.css, so light/dark switch without `dark:` variants.
const v = (name: string) => `var(--${name})`;
const scale = <K extends string>(prefix: string, keys: readonly K[]) =>
  Object.fromEntries(keys.map((k) => [k, v(`${prefix}-${k}`)])) as Record<K, string>;
const semantic = (name: string) => ({ DEFAULT: v(name), bg: v(`${name}-bg`) });

const preset = {
  content: [],
  theme: {
    // Replaces Tailwind's default palette: only token colours exist.
    colors: {
      transparent: "transparent",
      current: "currentColor",
      inherit: "inherit",
      brand: {
        ...scale("brand", ["50", "100", "500", "600", "700"] as const),
        DEFAULT: v("brand-600"),
        foreground: v("on-brand"),
      },
      bg: v("bg"),
      surface: { DEFAULT: v("surface"), 2: v("surface-2"), 3: v("surface-3") },
      border: { DEFAULT: v("border"), strong: v("border-strong") },
      text: { DEFAULT: v("text"), 2: v("text-2"), 3: v("text-3") },
      success: semantic("success"),
      warning: semantic("warning"),
      danger: { ...semantic("danger"), foreground: v("on-danger") },
      info: semantic("info"),
      neutral: semantic("neutral"),
      avatar: Object.fromEntries(
        [1, 2, 3, 4, 5].map((n) => [n, { DEFAULT: v(`av-${n}`), text: v(`av-${n}t`) }]),
      ),
      paper: {
        DEFAULT: v("paper"),
        ink: v("paper-ink"),
        line: v("paper-line"),
        muted: v("paper-muted"),
        hl: v("paper-hl"),
        "hl-ring": v("paper-hl-ring"),
        scan: v("paper-scan"),
      },
      overlay: v("overlay"),
      "stage-glow": v("stage-glow"),
      // shadcn/ui names (W-01) → the same tokens, so generated components need no extra palette.
      background: v("bg"),
      foreground: v("text"),
      card: { DEFAULT: v("surface"), foreground: v("text") },
      popover: { DEFAULT: v("surface"), foreground: v("text") },
      primary: { DEFAULT: v("brand-600"), foreground: v("on-brand") },
      secondary: { DEFAULT: v("surface-2"), foreground: v("text") },
      muted: { DEFAULT: v("surface-2"), foreground: v("text-3") },
      accent: { DEFAULT: v("brand-50"), foreground: v("brand-700") },
      destructive: { DEFAULT: v("danger"), foreground: v("on-danger") },
      input: v("border-strong"),
      ring: v("brand-500"),
    },
    fontFamily: { sans: v("font"), mono: v("mono") },
    fontSize: {
      ...scale("fs", ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl"] as const),
      base: v("fs-md"),
    },
    borderRadius: {
      none: "0",
      ...scale("r", ["sm", "md", "lg", "xl", "full"] as const),
      // shadcn/Tailwind defaults → nearest token
      DEFAULT: v("r-md"),
      xs: v("r-sm"),
    },
    boxShadow: {
      none: "none",
      ...scale("sh", ["1", "2", "3"] as const),
      // shadcn/Tailwind defaults → nearest token
      DEFAULT: v("sh-1"),
      xs: v("sh-1"),
      sm: v("sh-1"),
      md: v("sh-2"),
      lg: v("sh-3"),
    },
    extend: {
      // Tailwind's numeric spacing already uses a 4px step; these pin it to the token values.
      spacing: {
        ...scale("sp", ["1", "2", "3", "4", "5", "6", "8", "10", "12"] as const),
        topbar: v("topbar-h"),
      },
      transitionDuration: { base: v("dur") },
      transitionTimingFunction: { base: v("ease") },
    },
  },
} satisfies Config;

export default preset;
