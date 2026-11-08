import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import simpleImportSort from "eslint-plugin-simple-import-sort";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // coding-standards: import order is automatic (`eslint --fix`).
  {
    plugins: { "simple-import-sort": simpleImportSort },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
  // Formatting is Prettier's job (root .prettierrc.json).
  prettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    "src/lib/api/generated/**",
  ]),
]);
