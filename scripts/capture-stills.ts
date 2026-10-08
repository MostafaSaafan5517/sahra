/**
 * Captures the Lab's day stills: the live scene at dawn, midday and dusk, for the scroll story's
 * horizontal pan (`lab/index.html`). Run `pnpm stills` after changing how the scene looks.
 *
 * It builds and serves the site and opens the scene at its densest tier with the tuning panel
 * (`?quality=high&tune`; headless Chromium has only software WebGL, which `?quality` accepts).
 * For each moment it jumps the light there through the panel, hides the text and the panel,
 * screenshots the scene and has the browser encode it as WebP at each width the page offers.
 * The scene keeps moving, so every capture is a slightly different picture.
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { build, preview } from "vite";
import { encodeWebp } from "./encode-webp.ts";

const OUT_DIR = "src/lab/stills";
const PORT = 3302;
const QUALITY = 0.6;
/** Points of the light cycle (0 dawn, 1/3 midday, 2/3 dusk; the poster's dusk is 0.62). */
const STILLS = [
  { name: "dawn", phase: 0.02 },
  { name: "midday", phase: 0.33 },
  { name: "dusk", phase: 0.62 },
];
// Square, so the page can crop each to 3 by 2 on wide screens and 4 by 5 on phones. Grains are
// sized in CSS pixels: a laptop-sized window keeps them as fine as in the live scene.
const VIEWPORT = { width: 960, height: 960 };
const SCALE = 1.5;
const WIDTHS = [720, 1080, 1440];

await build({ logLevel: "warn" });
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: "warn" });
const browser = await chromium.launch();
try {
  mkdirSync(OUT_DIR, { recursive: true });
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
  await page.goto(`http://localhost:${String(PORT)}/?quality=high&tune`);
  await page.locator('[data-scene][data-state="running"]').waitFor();
  const canvas = page.locator("[data-scene] canvas");
  // The canvas fades in over the poster once its first frame is drawn.
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector("[data-scene] canvas") ?? document.body).opacity ===
      "1",
  );
  await page.getByText("Tune the scene").waitFor();
  await page.addStyleTag({ content: "main, footer { visibility: hidden; }" });
  const panel = page.locator(".lil-gui").first();
  const phaseInput = page.locator(".lil-controller", { hasText: "startPhase" }).locator("input");

  for (const still of STILLS) {
    await panel.evaluate((element: HTMLElement) => (element.style.visibility = "visible"));
    await phaseInput.fill(String(still.phase));
    await phaseInput.press("Enter");
    await panel.evaluate((element: HTMLElement) => (element.style.visibility = "hidden"));
    // A few frames at the new light (software WebGL draws only a few a second at this tier).
    await page.waitForTimeout(1500);
    const png = await canvas.screenshot();
    for (const width of WIDTHS) {
      const file = `${OUT_DIR}/${still.name}-${String(width)}.webp`;
      const webp = await encodeWebp(page, png, width, QUALITY);
      writeFileSync(file, webp);
      console.info(`${file}  ${String(Math.round(webp.length / 1024))} kB`);
    }
  }
} finally {
  await browser.close();
  await server.close();
}
