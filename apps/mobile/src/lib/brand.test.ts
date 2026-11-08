import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import { brand } from "./brand";

const css = readFileSync(
  createRequire(import.meta.url).resolve("@payproof/design-tokens/tokens.css"),
  "utf8",
);

function tokenIn(selector: string, name: string): string | undefined {
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(start, css.indexOf("}", start));
  return block
    .match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]
    ?.trim()
    .toLowerCase();
}

describe("brand colours mirror design tokens", () => {
  it("primary is light --brand-600", () => {
    expect(brand.primary).toBe(tokenIn(":root", "brand-600"));
  });

  it("backgrounds are --bg in light and dark", () => {
    expect(brand.backgroundLight).toBe(tokenIn(":root", "bg"));
    expect(brand.backgroundDark).toBe(tokenIn(':root[data-theme="dark"]', "bg"));
  });
});
