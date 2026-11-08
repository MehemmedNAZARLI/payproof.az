import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// Contrast guard for the mobile palette: text pairs must stay at WCAG AA (4.5:1) in both themes,
// and status/accent glyphs at 3:1 against the surface they sit on.
const css = readFileSync(resolve(process.cwd(), "src/styles/tokens.css"), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1], m[2]]));
}

const light = block(":root");
const dark = { ...light, ...block(':root:not([data-theme="light"])') };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const textPairs: [fg: string, bg: string][] = [
  ["text", "bg"],
  ["text-2", "surface"],
  ["text-2", "bg"],
  ["text-3", "surface"],
  ["text-3", "bg"],
  ["accent-ink", "accent-soft"],
  ["success-ink", "success-soft"],
  ["warning-ink", "warning-soft"],
  ["danger-ink", "danger-soft"],
  ["neutral-ink", "neutral-soft"],
  ["accent", "surface"],
  ["on-accent", "accent-fill"],
  ["on-danger", "danger-fill"],
];

const glyphPairs: [fg: string, bg: string][] = [
  ["success-ink", "surface"],
  ["warning-ink", "surface"],
  ["danger-ink", "surface"],
];

describe.each([
  ["light", light],
  ["dark", dark],
])("%s palette", (_, palette) => {
  it.each(textPairs)("%s on %s reads at 4.5:1", (fg, bg) => {
    expect(contrast(palette[fg]!, palette[bg]!)).toBeGreaterThanOrEqual(4.5);
  });
  it.each(glyphPairs)("%s on %s is visible at 3:1", (fg, bg) => {
    expect(contrast(palette[fg]!, palette[bg]!)).toBeGreaterThanOrEqual(3);
  });
});
