import { writeFileSync } from "node:fs";
import { OUTPUT, generateSchema } from "./schema.mjs";

writeFileSync(OUTPUT, await generateSchema());
console.log(`✓ ${OUTPUT.pathname}`);
