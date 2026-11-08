import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const prototype = read("../../../docs/product/prototype/payproof-prototype.html");
const tokens = read("../tokens.css");

// Formatting-only differences (hex case, leading zeros, spaces) are not value changes.
const normalize = (v: string) =>
  v
    .trim()
    .toLowerCase()
    .replace(/(^|[\s,(])\.(\d)/g, (_, pre: string, d: string) => `${pre}0.${d}`)
    .replace(/\s*,\s*/g, ",")
    .replace(/\s+/g, " ");

// Custom properties declared directly inside the first `{ … }` after `start`.
function vars(css: string, start: number): Map<string, string> {
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  const body = css.slice(open + 1, close).replace(/\/\*[\s\S]*?\*\//g, "");
  return new Map(
    [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1]!, normalize(m[2]!)]),
  );
}
const block = (css: string, marker: string) => {
  const at = css.indexOf(marker);
  if (at < 0) throw new Error(`marker not found: ${marker}`);
  // for a media query the declarations live in the nested rule
  return vars(css, marker.startsWith("@media") ? css.indexOf("{", at) + 1 : at);
};

describe("tokens.css matches the prototype", () => {
  it("light :root variables are identical", () => {
    const expected = block(prototype, ":root{");
    expect(expected.size).toBeGreaterThan(70);
    expect(Object.fromEntries(block(tokens, ":root {"))).toEqual(Object.fromEntries(expected));
  });

  it('dark variables are identical, both for the OS preference and for data-theme="dark"', () => {
    const expected = Object.fromEntries(block(prototype, "@media (prefers-color-scheme:dark)"));
    expect(Object.keys(expected).length).toBeGreaterThan(30);
    expect(Object.fromEntries(block(tokens, "@media (prefers-color-scheme: dark)"))).toEqual(
      expected,
    );
    expect(Object.fromEntries(block(tokens, ':root[data-theme="dark"] {'))).toEqual(expected);
  });

  it("an explicit light theme opts out of the OS dark preference", () => {
    expect(tokens).toContain(':root:not([data-theme="light"]) {');
  });
});
