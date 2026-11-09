import { loginText } from "@payproof/api-client/i18n";

// Places that cannot read CSS variables (viewport theme-color, web manifest) need literal colours.
// Each value mirrors src/styles/tokens.css — brand.test.ts fails if they drift.
export const brand = {
  /** --bg (light) */
  backgroundLight: "#f5f6fa",
  /** --bg (dark) */
  backgroundDark: "#05060a",
} as const;

export const appName = loginText.brand;
export const appDescription = loginText.tagline;
