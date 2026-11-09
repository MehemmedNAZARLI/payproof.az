import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { createMockApi } from "../src";

describe("contract coverage", () => {
  it("every operation in openapi.yaml has an MSW handler", () => {
    const doc = parse(
      readFileSync(new URL("../../contracts/openapi.yaml", import.meta.url), "utf8"),
    );
    const norm = (p: string) => p.replace(/\{[^}]+\}|:[a-z_]+/g, ":id");
    const contract = Object.entries(doc.paths as Record<string, object>).flatMap(([path, ops]) =>
      Object.keys(ops)
        .filter((m) => ["get", "post", "patch", "delete", "put"].includes(m))
        .map((m) => `${m.toUpperCase()} ${norm(path)}`),
    );
    const handled = new Set(
      createMockApi().handlers.map((h) => {
        const info = h.info as { method?: string; path?: string };
        return `${info.method} ${norm(String(info.path).replace(/^\*/, ""))}`;
      }),
    );
    expect(contract.length).toBe(36);
    expect(contract.filter((op) => !handled.has(op))).toEqual([]);
  });
});
