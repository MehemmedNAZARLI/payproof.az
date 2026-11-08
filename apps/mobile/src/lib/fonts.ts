import localFont from "next/font/local";

// Inter, self-hosted through next/font (no request to a font CDN, works offline from the precache).
// Two faces: Latin, and Latin Extended for Azerbaijani letters (ə, ğ, ı, ş). The CSS stack lists
// both, so the browser takes each glyph from the first face that has it. next/font needs literal
// options, hence the repetition.
export const inter = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
  adjustFontFallback: "Arial",
  variable: "--font-inter",
});

export const interExt = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
  adjustFontFallback: "Arial",
  variable: "--font-inter-ext",
});
