import { test as base, expect } from "@playwright/test";

/** Playwright's `test`, plus one rule for every test: the page must not log errors or throw. */
export const test = base.extend<{ failOnPageErrors: undefined }>({
  failOnPageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await use(undefined);
      expect(errors, "errors logged by the page").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
