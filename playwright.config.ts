import { defineConfig, devices } from "@playwright/test";

const PORT = 3301;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // An Android phone profile: small viewport, touch, mobile user agent.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // Tests run against the production build, like the deployed site.
  webServer: {
    command: "pnpm build && pnpm preview",
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: !process.env.CI,
  },
});
