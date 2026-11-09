// Places that cannot read CSS variables (viewport theme-color, web manifest) need literal colours.
// Each value mirrors src/styles/tokens.css — brand.test.ts fails if they drift.
export const brand = {
  /** --bg (light) */
  backgroundLight: "#f5f6fa",
} as const;

export const appName = "PayProof";
export const appDescription = "AI reads your documents. Rules check them. You approve the form.";
