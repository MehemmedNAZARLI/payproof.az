import type { Config } from "tailwindcss";

// Mobile-only light theme: every value is a variable from src/styles/tokens.css.
// Tailwind v4 loads this through `@config` in globals.css.
const v = (name: string) => `var(--${name})`;
const tone = (name: string) => ({
  DEFAULT: v(name),
  ink: v(`${name}-ink`),
  soft: v(`${name}-soft`),
});

// iOS text styles, retuned for Inter (wider than SF, so display sizes track tighter).
type Style = [
  size: string,
  opts: { lineHeight: string; letterSpacing: string; fontWeight?: string },
];
const style = (size: number, line: number, tracking: number, weight?: number): Style => [
  `${size}px`,
  {
    lineHeight: `${line}px`,
    letterSpacing: `${tracking}px`,
    ...(weight ? { fontWeight: String(weight) } : {}),
  },
];

const config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      inherit: "inherit",
      white: "#ffffff",
      bg: v("bg"),
      surface: { DEFAULT: v("surface"), 2: v("surface-2"), 3: v("surface-3") },
      separator: v("separator"),
      text: { DEFAULT: v("text"), 2: v("text-2"), 3: v("text-3") },
      accent: {
        DEFAULT: v("accent"),
        fill: v("accent-fill"),
        press: v("accent-press"),
        soft: v("accent-soft"),
        ink: v("accent-ink"),
        foreground: v("on-accent"),
      },
      success: tone("success"),
      warning: tone("warning"),
      danger: { ...tone("danger"), fill: v("danger-fill"), foreground: v("on-danger") },
      neutral: { ink: v("neutral-ink"), soft: v("neutral-soft") },
      // Flat keys: a nested numeric key ("avatar.1") is dropped by Tailwind's JS-config bridge.
      ...Object.fromEntries(
        [1, 2, 3, 4, 5].flatMap((n) => [
          [`av-${n}`, v(`av-${n}`)],
          [`av-${n}-text`, v(`av-${n}t`)],
        ]),
      ),
      hero: { text2: v("hero-text-2"), fill: v("hero-fill") },
      paper: {
        DEFAULT: v("paper"),
        ink: v("paper-ink"),
        line: v("paper-line"),
        muted: v("paper-muted"),
        hl: v("paper-hl"),
        "hl-ring": v("paper-hl-ring"),
        scan: v("paper-scan"),
      },
      stage: v("stage"),
      overlay: v("overlay"),
    },
    fontFamily: {
      sans: [
        "var(--font-inter)",
        "var(--font-inter-ext)",
        "-apple-system",
        "system-ui",
        "sans-serif",
      ],
      mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
    },
    fontSize: {
      large: style(34, 41, -0.4, 700),
      title1: style(28, 34, -0.4, 700),
      title2: style(22, 28, -0.3, 700),
      title3: style(20, 25, -0.25, 600),
      headline: style(17, 22, -0.2, 600),
      body: style(17, 22, -0.2),
      callout: style(16, 21, -0.15),
      subhead: style(15, 20, -0.1),
      footnote: style(13, 18, -0.04),
      caption: style(12, 16, 0),
      caption2: style(11, 13, 0.06),
    },
    borderRadius: {
      none: "0",
      sm: v("r-sm"),
      md: v("r-md"),
      lg: v("r-lg"),
      xl: v("r-xl"),
      full: v("r-full"),
    },
    boxShadow: {
      none: "none",
      1: v("elev-1"),
      2: v("elev-2"),
      3: v("elev-3"),
      accent: v("elev-accent"),
    },
    extend: {
      transitionDuration: { base: v("dur") },
      transitionTimingFunction: { base: v("ease") },
    },
  },
} satisfies Config;

export default config;
