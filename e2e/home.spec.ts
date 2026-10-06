import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { SITE_NAME } from "../src/config.ts";
import { expect, test } from "./test";

/** Waits until the scene has drawn its first frame and finished fading in. */
async function runningSceneCanvas(page: Page) {
  await expect(page.locator("[data-scene]")).toHaveAttribute("data-state", "running");
  const canvas = page.locator("[data-scene] canvas");
  await expect(canvas).toHaveCSS("opacity", "1");
  return canvas;
}

/**
 * Whether the running scene's pixels change over half a second. Compares raw bytes: a failing
 * `toEqual` on two large screenshots would spend minutes building a diff.
 */
async function sceneMoves(page: Page): Promise<boolean> {
  const canvas = await runningSceneCanvas(page);
  const before = await canvas.screenshot();
  await page.waitForTimeout(500);
  return !(await canvas.screenshot()).equals(before);
}

test("shows the content with the site name", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(SITE_NAME);
  await expect(page.getByRole("heading", { level: 1, name: SITE_NAME })).toBeVisible();
});

test("has no accessibility violations with the scene running", async ({ page }) => {
  await page.goto("/");
  await runningSceneCanvas(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  expect(
    violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) })),
  ).toEqual([]);
});

test("downloads the scene only after the page has loaded, and hides it from screen readers", async ({
  page,
}) => {
  await page.goto("/");
  await runningSceneCanvas(page);
  await expect(page.locator("[data-scene]")).toHaveAttribute("aria-hidden", "true");

  const timing = await page.evaluate(() => {
    const [navigation] = performance.getEntriesByType(
      "navigation",
    ) as PerformanceNavigationTiming[];
    const scene = performance
      .getEntriesByType("resource")
      .find((entry) => /\/assets\/scene-[\w-]+\.js$/.test(entry.name));
    return { loadEventEnd: navigation?.loadEventEnd, sceneRequestedAt: scene?.startTime };
  });
  expect(timing.loadEventEnd).toBeDefined();
  expect(timing.sceneRequestedAt).toBeGreaterThan(timing.loadEventEnd ?? Infinity);
});

test("animates the scene", async ({ page }) => {
  await page.goto("/");
  expect(await sceneMoves(page), "the scene moves").toBe(true);
});

test.describe("with reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("draws one still frame", async ({ page }) => {
    await page.goto("/");
    expect(await sceneMoves(page), "the scene moves").toBe(false);
  });
});
