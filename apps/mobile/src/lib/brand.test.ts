import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { brand } from "./brand";

const css = readFileSync(resolve(process.cwd(), "src/styles/tokens.css"), "utf8");

function tokenIn(selector: string, name: string): string | undefined {
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(start, css.indexOf("}", start));
  return block
    .match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]
    ?.trim()
    .toLowerCase();
}

describe("brand colours mirror design tokens", () => {
  it("background is --bg", () => {
    expect(brand.backgroundLight).toBe(tokenIn(":root", "bg"));
  });
});
