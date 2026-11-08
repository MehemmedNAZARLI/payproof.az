// Places that cannot read CSS variables (viewport theme-color, web manifest) need literal colours.
// Each value mirrors packages/design-tokens/tokens.css — brand.test.ts fails if they drift.
export const brand = {
  /** --brand-600 (light) */
  primary: "#0d5d6b",
  /** --bg (light) */
  backgroundLight: "#f4f5f2",
  /** --bg (dark) */
  backgroundDark: "#0e1312",
} as const;

// shortcut: move to @payproof/api-client/i18n once it exists (S-05).
export const appName = "PayProof";
export const appDescription = "Faktura paketlərinin hazırlığı və təsdiqi";
