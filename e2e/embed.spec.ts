import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { SITE_NAME } from "../src/config.ts";
import { expect, test } from "./test";

/**
 * Another site, on another origin, that embeds the scene with the same script tag a real site
 * would use. Playwright serves the page itself; the script comes from the preview server, so the
 * script and the scene's chunk load across origins, as they do from Webflow or WordPress.
 */
const HOST = "http://host.localhost:3399/";

// Chrome asks permission before a page fetches from this machine's own address (local network
// access), which a real site loading the script from this site's domain never does. The tests
// serve the script from localhost, so the check is off here. Cross-origin rules (CORS) still apply.
test.use({ launchOptions: { args: ["--disable-features=LocalNetworkAccessChecks"] } });
const EMBED_SCRIPT = "http://localhost:3301/embed/sahra.js";
const SCENE_CHUNK = /\/embed\/assets\/sahra-scene-[\w-]+\.js$/;

async function openHostPage(page: Page, body: string): Promise<void> {
  await page.route(HOST, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>A site that embeds the scene</title>
  </head>
  <body style="margin: 0; font-family: sans-serif">
    ${body}
    <script type="module" src="${EMBED_SCRIPT}"></script>
  </body>
</html>`,
    }),
  );
  await page.goto(HOST);
}

/** The colour of one pixel of an element, as [red, green, blue], read from a screenshot. */
async function pixelOf(page: Page, selector: string, x: number, y: number): Promise<number[]> {
  const png = await page.locator(selector).screenshot();
  return page.evaluate(
    async ({ base64, x, y }) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No 2D canvas to read pixels with.");
      context.drawImage(bitmap, 0, 0);
      return [...context.getImageData(x, y, 1, 1).data.slice(0, 3)];
    },
    { base64: png.toString("base64"), x, y },
  );
}

test("runs on another site's page from one script tag, in every box that asks for it", async ({
  page,
}) => {
  await openHostPage(
    page,
    `<div id="one" data-sahra data-quality="minimal" style="height: 240px"></div>
     <div id="two" data-sahra data-quality="minimal" style="height: 200px; margin-top: 24px"></div>`,
  );
  for (const id of ["#one", "#two"]) {
    const box = page.locator(id);
    await expect(box).toHaveAttribute("data-state", "running");
    await expect(box).toHaveCSS("position", "relative");
    const canvas = box.locator("canvas");
    await expect(canvas).toHaveCSS("opacity", "1");
    const [boxSize, canvasSize] = await Promise.all([box.boundingBox(), canvas.boundingBox()]);
    expect(canvasSize).toEqual(boxSize);
    await expect(box.locator("> div")).toHaveAttribute("aria-hidden", "true");
  }
});

test("keeps the page's own content in the box above the scene", async ({ page }) => {
  await openHostPage(
    page,
    `<div data-sahra data-quality="minimal" style="height: 300px; padding: 32px">
       <p id="words" style="margin: 0; font-size: 32px">Over the dunes</p>
     </div>`,
  );
  await expect(page.locator("[data-sahra]")).toHaveAttribute("data-state", "running");
  const topmost = await page.locator("#words").evaluate((words) => {
    const box = words.getBoundingClientRect();
    return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.id;
  });
  expect(topmost).toBe("words");
});

test("takes its light and colours from data attributes", async ({ page }) => {
  await openHostPage(
    page,
    `<div data-sahra data-quality="minimal" data-sky="#ff0000" style="height: 320px"></div>`,
  );
  await expect(page.locator("[data-sahra]")).toHaveAttribute("data-state", "running");
  await expect(page.locator("[data-sahra] canvas")).toHaveCSS("opacity", "1");
  // The top of the sky is the sky colour (with a faint grain).
  const [red = 0, green = 0, blue = 0] = await pixelOf(page, "[data-sahra] canvas", 40, 2);
  expect(red).toBeGreaterThan(200);
  expect(green + blue).toBeLessThan(60);
});

test("says in the console what it cannot use, and runs without it", async ({ page }) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning") warnings.push(message.text());
  });
  await openHostPage(
    page,
    `<div data-sahra data-quality="minimal" data-sand="gold" style="height: 200px"></div>`,
  );
  await expect(page.locator("[data-sahra]")).toHaveAttribute("data-state", "running");
  expect(warnings).toContain('Sahra: data-sand="gold" is not a colour like #efa463.');
});

test("starts a scene only once its box comes near the screen", async ({ page }) => {
  const sceneRequests: string[] = [];
  page.on("request", (request) => {
    if (SCENE_CHUNK.test(request.url())) sceneRequests.push(request.url());
  });
  await openHostPage(
    page,
    `<div style="height: 300vh">A long page.</div>
     <div data-sahra data-quality="minimal" style="height: 240px"></div>`,
  );
  await page.waitForLoadState("load");
  await page.waitForTimeout(1500);
  expect(sceneRequests, "nothing downloaded for a box far down the page").toEqual([]);
  await expect(page.locator("[data-sahra]")).not.toHaveAttribute("data-state");

  await page.locator("[data-sahra]").scrollIntoViewIfNeeded();
  await expect(page.locator("[data-sahra]")).toHaveAttribute("data-state", "running");
});

test("leaves the box's own background where the scene cannot run, and downloads nothing", async ({
  page,
}) => {
  // Headless Chromium has only software WebGL: without data-quality, no scene, as on a weak device.
  const sceneRequests: string[] = [];
  page.on("request", (request) => {
    if (SCENE_CHUNK.test(request.url())) sceneRequests.push(request.url());
  });
  await openHostPage(page, `<div data-sahra style="height: 240px; background: #2e170d"></div>`);
  const box = page.locator("[data-sahra]");
  await expect(box).toHaveAttribute("data-state", "low-power");
  await expect(box.locator("canvas")).toHaveCount(0);
  await expect(box).toHaveCSS("background-color", "rgb(46, 23, 13)");
  expect(sceneRequests).toEqual([]);
});

test("starts boxes added to the page later, and releases the scene of a box taken away", async ({
  page,
}) => {
  await openHostPage(page, `<main id="app"></main>`);
  await page.locator("#app").evaluate((app) => {
    app.innerHTML = `<div data-sahra data-quality="minimal" style="height: 240px"></div>`;
  });
  const box = page.locator("[data-sahra]");
  await expect(box).toHaveAttribute("data-state", "running");

  // Keep hold of the canvas, then take the box away, as a single-page app's navigation would.
  const canvas = await box.locator("canvas").elementHandle();
  await box.evaluate((element) => {
    element.remove();
  });
  await expect
    .poll(() =>
      canvas.evaluate(
        (element: HTMLCanvasElement) => element.getContext("webgl2")?.isContextLost() ?? true,
      ),
    )
    .toBe(true);
});

test("starts a box inside a shadow root when the page asks with mount()", async ({ page }) => {
  // A web component's own markup is out of the script's sight, so the page mounts the box itself.
  await openHostPage(
    page,
    `<my-hero></my-hero>
     <script>
       customElements.define("my-hero", class extends HTMLElement {
         constructor() {
           super();
           this.attachShadow({ mode: "open" }).innerHTML =
             '<div data-sahra data-quality="minimal" style="height: 240px"></div>';
         }
       });
     </script>
     <script type="module">
       import { mount } from "${EMBED_SCRIPT}";
       mount(document.querySelector("my-hero").shadowRoot.querySelector("[data-sahra]"));
     </script>`,
  );
  await expect(page.locator("my-hero [data-sahra]")).toHaveAttribute("data-state", "running");
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("draws one still frame", async ({ page }) => {
    await openHostPage(page, `<div data-sahra data-quality="minimal" style="height: 240px"></div>`);
    await expect(page.locator("[data-sahra]")).toHaveAttribute("data-state", "running");
    const canvas = page.locator("[data-sahra] canvas");
    const before = await canvas.screenshot();
    await page.waitForTimeout(500);
    expect((await canvas.screenshot()).equals(before), "the frame stayed still").toBe(true);
  });
});

test.describe("the demo page", () => {
  test("shows the embed on plain HTML, with the code to copy and the portfolio label", async ({
    page,
  }) => {
    await page.goto("/embed/");
    await expect(page).toHaveTitle(new RegExp(`^${SITE_NAME} embed: `));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The dune scene, on any page");
    await expect(page.locator("[data-sahra]")).toHaveCount(2);
    // Headless Chromium has only software WebGL, so both boxes keep their own background (each
    // decides once it is near the screen).
    for (const box of await page.locator("[data-sahra]").all()) {
      await box.scrollIntoViewIfNeeded();
      await expect(box).toHaveAttribute("data-state", "low-power");
    }
    await expect(
      page.getByText(
        EMBED_SCRIPT.replace("http://localhost:3301", "https://sahra-khaki.vercel.app"),
      ),
    ).toBeVisible();
    await expect(page.getByRole("contentinfo")).toContainText(
      "portfolio project by Mostafa Saafan",
    );
  });

  test("has no accessibility violations", async ({ page }) => {
    await page.goto("/embed/");
    await expect(page.locator("[data-sahra]").first()).toHaveAttribute("data-state", /.+/);
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
      .analyze();
    expect(
      violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) })),
    ).toEqual([]);
  });
});
