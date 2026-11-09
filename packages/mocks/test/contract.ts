// Validate mock responses against packages/contracts/openapi.yaml component schemas (no extra properties).
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse } from "yaml";

const doc = parse(readFileSync(new URL("../../contracts/openapi.yaml", import.meta.url), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema({ $id: "openapi", components: doc.components });

/** Throws with the ajv errors if `value` does not match `#/components/schemas/<name>`. */
export function assertSchema(name: string, value: unknown) {
  const validate = ajv.getSchema(`openapi#/components/schemas/${name}`);
  if (!validate) throw new Error(`no schema ${name}`);
  if (!validate(value))
    throw new Error(`${name}: ${ajv.errorsText(validate.errors, { separator: "\n" })}`);
}
