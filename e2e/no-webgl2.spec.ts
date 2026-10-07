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

test("keeps showing the poster in place of the scene", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-scene]")).toHaveAttribute("data-state", "unsupported");
  const poster = page.locator("[data-scene] img");
  await expect(poster).toBeVisible();
  expect(
    await poster.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    "the poster has loaded",
  ).toBe(true);
});
