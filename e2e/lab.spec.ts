import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { SITE_NAME } from "../src/config.ts";
import { expect, test } from "./test";

const LAB = "/lab/";

/** How much of each star's line is still to draw: 1 not started, 0 drawn. */
async function starsLeftToDraw(page: Page, selector = ".pattern-stars path"): Promise<number[]> {
  return page
    .locator(selector)
    .evaluateAll((paths) =>
      paths.map((path) => parseFloat(getComputedStyle(path).strokeDashoffset)),
    );
}

/** The drawing's CSS animations: their names and whether they run, wait or have finished. */
async function drawingAnimations(page: Page) {
  return page.locator(".drawing").evaluate((figure) =>
    figure.getAnimations({ subtree: true }).map((animation) => ({
      name: animation instanceof CSSAnimation ? animation.animationName : "",
      state: animation.playState,
    })),
  );
}

async function untilDrawn(page: Page): Promise<void> {
  await expect
    .poll(async () => Math.max(...(await starsLeftToDraw(page))), { timeout: 15_000 })
    .toBe(0);
}

const STORY_CHUNK = /\/assets\/story-[\w-]+\.js$/;

/**
 * Waits until GSAP has turned the story into the scroll story and laid out both pins, then says
 * where each pinned part starts on the page and how far the page scrolls while it is pinned.
 */
async function storyPins(page: Page) {
  await page.locator("[data-story][data-enhanced]").waitFor();
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll(".pin-spacer")].filter(
        (spacer) => parseFloat(getComputedStyle(spacer).paddingBottom) > 0,
      ).length === 2,
  );
  const [reveal, pan] = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".pin-spacer")].map((spacer) => ({
      top: spacer.getBoundingClientRect().top + scrollY,
      length: parseFloat(getComputedStyle(spacer).paddingBottom),
    })),
  );
  if (!reveal || !pan) throw new Error("The story has no pins.");
  return { reveal, pan };
}

async function scrollToY(page: Page, y: number): Promise<void> {
  await page.evaluate((top) => {
    scrollTo(0, top);
  }, y);
}

const opacities = (page: Page, selector: string) =>
  page
    .locator(selector)
    .evaluateAll((nodes) => nodes.map((node) => Number(getComputedStyle(node).opacity)));

/** How far the day's row has slid left, in pixels. */
const rowShift = (page: Page) =>
  page
    .locator("[data-story-track]")
    .evaluate((track) => -new DOMMatrix(getComputedStyle(track).transform).m41);

test("shows the Lab: its title, the line drawing, the way home and the portfolio label", async ({
  page,
}) => {
  const sceneRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/assets\/scene-[\w-]+\.js$/.test(request.url())) sceneRequests.push(request.url());
  });
  await page.goto(LAB);
  await expect(page).toHaveTitle(new RegExp(`^${SITE_NAME} Lab: `));
  await expect(page.getByRole("heading", { level: 1, name: "Lab" })).toBeVisible();
  await expect(page.getByRole("link", { name: SITE_NAME, exact: true })).toHaveAttribute(
    "href",
    "/",
  );
  await expect(page.getByRole("link", { name: "Hire on Upwork" })).toHaveAttribute(
    "href",
    "https://www.upwork.com/freelancers/~0104fa36ecdc4bf8a1",
  );
  await expect(
    page.getByRole("heading", { level: 2, name: "A pattern that draws itself" }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: /^Eight-point stars/ })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toContainText("portfolio project by Mostafa Saafan");
  expect(sceneRequests, "the Lab never downloads Three.js").toEqual([]);
});

test("is one click from the home page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "The Lab" }).click();
  await expect(page).toHaveURL(new RegExp(`${LAB}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Lab" })).toBeVisible();
});

test("has no accessibility violations", async ({ page }) => {
  await page.goto(LAB);
  await untilDrawn(page);
  await storyPins(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  expect(
    violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) })),
  ).toEqual([]);
});

test("reaches every link and button from the keyboard, with a visible focus ring", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Keyboard focus is a desktop concern; phones have no Tab key.");
  await page.goto(LAB);
  for (const target of [
    page.getByRole("link", { name: SITE_NAME, exact: true }),
    page.getByRole("link", { name: "Hire on Upwork" }),
    page.getByRole("button", { name: "Draw it again" }),
  ]) {
    await page.keyboard.press("Tab");
    await expect(target).toBeFocused();
    const outline = await target.evaluate((node) => {
      const style = getComputedStyle(node);
      return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThanOrEqual(2);
  }
});

test("moves nothing while it loads, even when its script comes late: no layout shift", async ({
  page,
}) => {
  // A slow phone paints the page before the script runs; holding the script back makes that sure.
  await page.route(/\/assets\/lab-[\w-]+\.js$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.continue();
  });
  await page.goto(LAB);
  // Including the moment GSAP pins the story's parts: the pins add room below them, off screen.
  await storyPins(page);
  const shift = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & { value: number })[]) {
            total += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
        setTimeout(() => {
          resolve(total);
        }, 500);
      }),
  );
  expect(shift).toBe(0);
});

test("lays out the same before and after its script runs", async ({ page }) => {
  // Where the page's parts sit (top and height), from the top of the page, down to the story's
  // first pinned part: the pins add room below themselves by design.
  const layout = () =>
    page.evaluate(() =>
      [
        "h1",
        "#drawing-title",
        ".drawing",
        ".drawing + div",
        "#story-title",
        "[data-story-reveal]",
      ].map((selector) => {
        const box = document.querySelector(selector)?.getBoundingClientRect();
        return {
          selector,
          top: Math.round((box?.top ?? NaN) + scrollY),
          height: Math.round(box?.height ?? NaN),
        };
      }),
    );
  // As a visitor sees it before the script has run (or without it): the script comes back empty.
  await page.route(/\/assets\/lab-[\w-]+\.js$/, (route) =>
    route.fulfill({ contentType: "text/javascript", body: "" }),
  );
  await page.goto(LAB);
  const before = await layout();
  await page.unrouteAll();

  // Once the script has run, the story's GSAP included.
  await page.goto(LAB);
  await storyPins(page);
  expect(await layout()).toEqual(before);
});

test("draws the pattern from the center out, then shows it whole", async ({ page }) => {
  await page.goto(LAB);
  expect(Math.min(...(await starsLeftToDraw(page))), "nothing drawn at first").toBeGreaterThan(0);
  const centre = ".pattern-stars-large path[style='--order:0']";
  await expect
    .poll(async () => (await starsLeftToDraw(page, centre))[0], { intervals: [50] })
    .toBe(0);
  const farthest = await starsLeftToDraw(page, ".pattern-stars path[style='--order:1']");
  expect(Math.min(...farthest), "the farthest stars, when the centre one is done").toBeGreaterThan(
    0,
  );
  await untilDrawn(page);
});

test("waits until the drawing is on screen, and rests its light while it is off screen", async ({
  page,
}) => {
  // A window too short to show the drawing until the visitor scrolls.
  await page.setViewportSize({ width: page.viewportSize()?.width ?? 1280, height: 320 });
  await page.goto(LAB);
  await expect
    .poll(async () => (await drawingAnimations(page)).map((animation) => animation.state))
    .not.toContain("running");
  expect(Math.min(...(await starsLeftToDraw(page)))).toBe(1);

  await page.locator(".pattern").scrollIntoViewIfNeeded();
  await untilDrawn(page);
  const glints = async () =>
    (await drawingAnimations(page))
      .filter((animation) => animation.name === "pattern-glint")
      .map((animation) => animation.state);
  expect(await glints()).toContain("running");

  await page.evaluate(() => {
    scrollTo(0, 0);
  });
  await expect.poll(glints).not.toContain("running");
});

test("draws it again on request", async ({ page }) => {
  await page.goto(LAB);
  await untilDrawn(page);
  await page.getByRole("button", { name: "Draw it again" }).click();
  expect(Math.min(...(await starsLeftToDraw(page))), "every star starts over").toBeGreaterThan(0);
  await page.locator(".pattern").scrollIntoViewIfNeeded();
  await untilDrawn(page);
});

test("loads the scroll story's GSAP only once the page has loaded", async ({ page }) => {
  await page.goto(LAB);
  await storyPins(page);
  const timing = await page.evaluate((chunk) => {
    const [navigation] = performance.getEntriesByType(
      "navigation",
    ) as PerformanceNavigationTiming[];
    const story = performance
      .getEntriesByType("resource")
      .find((entry) => new RegExp(chunk).test(entry.name));
    return { loadEventEnd: navigation?.loadEventEnd, storyRequestedAt: story?.startTime };
  }, STORY_CHUNK.source);
  expect(timing.loadEventEnd).toBeDefined();
  expect(timing.storyRequestedAt).toBeGreaterThan(timing.loadEventEnd ?? Infinity);
});

test("pins the lines and brings them up one by one as the page scrolls", async ({ page }) => {
  await page.goto(LAB);
  const { reveal } = await storyPins(page);
  const lines = "[data-story-line]";
  const note = "[data-story-note]";

  await scrollToY(page, reveal.top);
  await expect.poll(() => opacities(page, lines)).toEqual([1, 0, 0]);
  expect(await opacities(page, note)).toEqual([0]);

  // Each turn takes a third of the pinned scroll; opacities rounded to tenths.
  const linesNow = async () =>
    (await opacities(page, lines)).map((opacity) => Math.round(opacity * 10) / 10);

  // A third of the way: still pinned to the top of the window; the second line is up, the first
  // has stepped back and the third still waits.
  await scrollToY(page, reveal.top + reveal.length / 3);
  await expect
    .poll(async () => (await page.locator("[data-story-reveal]").boundingBox())?.y)
    .toBeCloseTo(0, 0);
  await expect.poll(linesNow).toEqual([0.4, 1, 0]);

  // Two thirds: the third line is up.
  await scrollToY(page, reveal.top + (2 * reveal.length) / 3);
  await expect.poll(linesNow).toEqual([0.4, 0.4, 1]);

  // The end: the note has come up too.
  await scrollToY(page, reveal.top + reveal.length);
  await expect.poll(async () => (await opacities(page, note))[0]).toBe(1);
});

test("pans the day's pictures sideways as the page scrolls, to the last panel", async ({
  page,
}) => {
  await page.goto(LAB);
  const { pan } = await storyPins(page);
  const width = page.viewportSize()?.width ?? 0;

  await scrollToY(page, pan.top);
  await expect.poll(() => rowShift(page)).toBeCloseTo(0, 0);

  await scrollToY(page, pan.top + pan.length);
  await expect
    .poll(async () => (await page.locator("[data-story-pan]").boundingBox())?.y)
    .toBeCloseTo(0, 0);
  await expect.poll(() => rowShift(page)).toBeCloseTo(pan.length, 0);
  const end = await page.getByRole("link", { name: "See it move" }).boundingBox();
  expect(end?.x).toBeGreaterThan(0);
  expect((end?.x ?? Infinity) + (end?.width ?? 0)).toBeLessThan(width);
  await expect
    .poll(() =>
      page
        .getByRole("img", { name: /^The dune scene at dusk/ })
        .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    )
    .toBe(true);
});

test("brings the last panel into view when its link gets keyboard focus", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Keyboard focus is a desktop concern; phones have no Tab key.");
  await page.goto(LAB);
  await storyPins(page);
  const link = page.getByRole("link", { name: "See it move" });
  await link.focus();
  await expect
    .poll(async () => {
      const box = await link.boundingBox();
      const viewport = page.viewportSize();
      return (
        !!box &&
        !!viewport &&
        box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= viewport.width &&
        box.y + box.height <= viewport.height
      );
    })
    .toBe(true);
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("keeps the story a plain page: every line shown, the pictures in a row to scroll, no GSAP", async ({
    page,
  }) => {
    const storyRequests: string[] = [];
    page.on("request", (request) => {
      if (STORY_CHUNK.test(request.url())) storyRequests.push(request.url());
    });
    await page.goto(LAB);
    await page.waitForLoadState("load");
    await page.waitForTimeout(1500);
    expect(storyRequests).toEqual([]);
    await expect(page.locator("[data-story][data-enhanced]")).toHaveCount(0);
    expect(await opacities(page, "[data-story-line], [data-story-note]")).toEqual([1, 1, 1, 1]);

    const track = page.locator("[data-story-track]");
    await expect(track).toHaveAttribute("tabindex", "0");
    const scrolls = await track.evaluate((row) => row.scrollWidth > row.clientWidth);
    expect(scrolls, "the row is wider than the window, and scrolls").toBe(true);
    await track.focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => track.evaluate((row) => row.scrollLeft)).toBeGreaterThan(0);
  });

  test("shows the finished drawing at once, with nothing moving and no replay", async ({
    page,
  }) => {
    await page.goto(LAB);
    expect(await drawingAnimations(page)).toEqual([]);
    expect(Math.max(...(await starsLeftToDraw(page)))).toBe(0);
    await expect(page.locator(".pattern-tiling")).toHaveCSS("opacity", "0.12");
    await expect(page.getByRole("button", { name: "Draw it again" })).toBeHidden();
  });
});
