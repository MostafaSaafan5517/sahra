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
  // Where the page's parts sit (top and height), from the top of the page.
  const layout = () =>
    page.evaluate(() =>
      ["h1", "#drawing-title", ".drawing", ".drawing + div", "footer"].map((selector) => {
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

  // Once the script has run and shown "Draw it again".
  await page.goto(LAB);
  await expect(page.getByRole("button", { name: "Draw it again" })).toBeVisible();
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

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

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
