import { defineConfig, devices } from "@playwright/test";

const PORT = 3301;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  // Headless Chromium draws WebGL on the CPU (SwiftShader), where a phone-sized page renders the
  // scene at about 12 frames a second. Two such pages at once starve each other (even the canvas
  // fade-in stalls), so the scene tests run one at a time.
  workers: 1,
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
