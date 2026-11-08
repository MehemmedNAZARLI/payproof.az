// Places that cannot read CSS variables (viewport theme-color, web manifest) need literal colours.
// Each value mirrors src/styles/tokens.css — brand.test.ts fails if they drift.
export const brand = {
  /** --bg (light) */
  backgroundLight: "#f5f6fa",
  /** --bg (dark) */
  backgroundDark: "#05060a",
} as const;

// shortcut: move to @payproof/api-client/i18n once it exists (S-05).
export const appName = "PayProof";
export const appDescription = "Faktura paketlərinin hazırlığı və təsdiqi";
