/**
 * Captures the scene's first frame as the poster: the picture the page shows before the scene has
 * loaded, and to visitors who get no live scene. Run `pnpm poster` after changing anything that
 * changes the first frame (settings, shaders, the light).
 *
 * It builds the site, serves it, and opens it with reduced motion, so the scene draws its first
 * frame and stops. `?quality=high` asks for the densest tier, and for the scene at all: headless
 * Chromium has only software WebGL, where the page would otherwise show the poster itself. With
 * the text hidden, it screenshots the scene and has the browser re-encode it as WebP at each
 * width the page offers (`srcset` in index.html).
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { build, preview } from "vite";
import { encodeWebp } from "./encode-webp.ts";

const OUT_DIR = "src/poster";
const PORT = 3302;
const QUALITY = 0.6;
const SHOTS = [
  // Grains are sized in CSS pixels, so each poster is captured at a typical window size (at double
  // resolution) for the grains to look as big as in the live scene.
  // Wide screens. 2:1 sits at the wide end of desktop windows: narrower ones crop the sides, which
  // keeps the same vertical framing as the live scene.
  {
    name: "landscape",
    viewport: { width: 1440, height: 720 },
    scale: 2,
    widths: [1440, 2048, 2880],
  },
  // Phones in portrait.
  { name: "portrait", viewport: { width: 430, height: 932 }, scale: 2, widths: [430, 860] },
];

await build({ logLevel: "warn" });
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: "warn" });
const browser = await chromium.launch();
try {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const shot of SHOTS) {
    const page = await browser.newPage({
      viewport: shot.viewport,
      deviceScaleFactor: shot.scale,
      reducedMotion: "reduce",
    });
    await page.goto(`http://localhost:${String(PORT)}/?quality=high`);
    await page.locator('[data-scene][data-state="running"]').waitFor();
    await page.addStyleTag({ content: "main, footer { visibility: hidden; }" });
    const png = await page.locator("[data-scene] canvas").screenshot();
    for (const width of shot.widths) {
      const file = `${OUT_DIR}/poster-${shot.name}-${String(width)}.webp`;
      const webp = await encodeWebp(page, png, width, QUALITY);
      writeFileSync(file, webp);
      console.info(`${file}  ${String(Math.round(webp.length / 1024))} kB`);
    }
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
