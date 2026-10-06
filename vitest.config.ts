import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // End-to-end specs in e2e/ belong to Playwright.
    include: ["src/**/*.test.ts"],
  },
});
