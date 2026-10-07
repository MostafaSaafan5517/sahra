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

/**
 * Drags across the lower half of the view, over the sand: a real touch drag on the phone profile
 * (through the DevTools protocol, as Playwright has no touch-drag helper), the mouse elsewhere.
 */
async function sweepAcrossTheSand(page: Page, isMobile: boolean): Promise<void> {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("The scene tests need a fixed viewport.");
  const { width, height } = viewport;
  const y = height * 0.75;
  if (!isMobile) {
    await page.mouse.move(width * 0.1, y);
    await page.mouse.move(width * 0.9, y, { steps: 12 });
    return;
  }
  const devtools = await page.context().newCDPSession(page);
  const fingerAt = (x: number) => [{ x, y }];
  await devtools.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: fingerAt(width * 0.1),
  });
  for (let step = 1; step <= 12; step++) {
    await devtools.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: fingerAt(width * (0.1 + (step * 0.8) / 12)),
    });
  }
  await devtools.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

test("shows the content with the site name", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(SITE_NAME);
  await expect(page.getByRole("heading", { level: 1, name: SITE_NAME })).toBeVisible();
});

test("shows the poster at once, picked for the screen's shape", async ({ page, isMobile }) => {
  await page.goto("/");
  const poster = page.locator("[data-scene] img");
  await expect(poster).toBeVisible();
  const { loaded, source } = await poster.evaluate((image: HTMLImageElement) => ({
    loaded: image.complete && image.naturalWidth > 0,
    source: image.currentSrc,
  }));
  expect(loaded, "the poster has loaded").toBe(true);
  expect(source).toContain(isMobile ? "poster-portrait" : "poster-landscape");
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

test("blows gusts from the mouse and the finger", async ({ page, isMobile }) => {
  await page.goto("/");
  await runningSceneCanvas(page);
  await sweepAcrossTheSand(page, isMobile);
  await page.waitForTimeout(300);
  await expect(page.locator("[data-scene]")).toHaveAttribute("data-state", "running");
});

test("opens a tuning panel with ?tune, and only then", async ({ page }) => {
  await page.goto("/");
  await runningSceneCanvas(page);
  await expect(page.getByText("Tune the scene")).toHaveCount(0);

  await page.goto("/?tune");
  await runningSceneCanvas(page);
  await expect(page.getByText("Tune the scene")).toBeVisible();
  await expect(page.getByText("windSpeed")).toBeVisible();
  await expect(page.getByText("Copy values")).toBeVisible();
});

test.describe("with reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("draws one still frame", async ({ page }) => {
    await page.goto("/");
    expect(await sceneMoves(page), "the scene moves").toBe(false);
  });

  test("keeps the still frame still when the pointer or a finger moves", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/");
    const canvas = await runningSceneCanvas(page);
    const before = await canvas.screenshot();
    await sweepAcrossTheSand(page, isMobile);
    await page.waitForTimeout(300);
    expect((await canvas.screenshot()).equals(before), "the still frame stayed still").toBe(true);
  });
});
