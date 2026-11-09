import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error — plain .mjs helper shared with the generate script
import { OUTPUT, generateSchema } from "../scripts/schema.mjs";

describe("generated schema", () => {
  it("is up to date with packages/contracts/openapi.yaml (run `pnpm generate`)", async () => {
    expect(readFileSync(OUTPUT, "utf8")).toBe(await generateSchema());
  }, 30_000);

  it("types multipart file fields as Blob", () => {
    expect(readFileSync(OUTPUT, "utf8")).toMatch(/file: Blob;/);
  });
});
