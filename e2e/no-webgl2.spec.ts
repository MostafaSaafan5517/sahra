import { SITE_NAME } from "../src/config.ts";
import { expect, test } from "./test";

// A real browser without WebGL2, rather than a patched page. Launch flags apply to the whole file.
test.use({ launchOptions: { args: ["--disable-webgl2"] } });

test("keeps the content and never downloads Three.js", async ({ page }) => {
  const sceneRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/assets\/scene-[\w-]+\.js$/.test(request.url())) sceneRequests.push(request.url());
  });
  await page.goto("/");
  await expect(page.locator("[data-scene]")).toHaveAttribute("data-state", "unsupported");
  await expect(page.getByRole("heading", { level: 1, name: SITE_NAME })).toBeVisible();
  await expect(page.locator("[data-scene] canvas")).toHaveCount(0);
  expect(sceneRequests).toEqual([]);
});
