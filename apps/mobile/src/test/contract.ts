import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { parse } from "yaml";

// Validates mock responses against packages/contracts/openapi.yaml (OpenAPI 3.1 = JSON Schema
// 2020-12), so the mock cannot drift from the contract the real API implements.

// Vitest runs from apps/mobile (also under turbo); jsdom gives import.meta.url no file path.
const spec: unknown = parse(
  readFileSync(resolve(process.cwd(), "../../packages/contracts/openapi.yaml"), "utf8"),
);
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(spec as object, "openapi");

/** Contract errors for `value` as schema `name`; an empty list means it conforms. */
export function contractErrors(name: string, value: unknown): string[] {
  const validate = ajv.getSchema(`openapi#/components/schemas/${name}`);
  if (!validate) throw new Error(`No schema ${name} in openapi.yaml`);
  return validate(value)
    ? []
    : (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`);
}
