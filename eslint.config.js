import js from "@eslint/js";
import prettier from "eslint-config-prettier/flat";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "dist/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    ".lighthouseci/**",
  ]),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.node.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Production code stays quiet; real failures may still be reported.
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["*.config.{js,ts}"],
    languageOptions: { globals: globals.node },
  },
  {
    // Plain JavaScript files (this config) are outside the TypeScript projects.
    files: ["**/*.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  // Last, so it switches off any ESLint rules that would fight Prettier's formatting.
  prettier,
]);
