import type { Page } from "@playwright/test";
import { expect, test } from "./test";

/**
 * Text must keep WCAG AA contrast over the scene in every light (the brief's readability rule).
 * At six points of the light cycle, the text is made transparent, and the background behind each
 * text element (scene, haze and wash together) is measured from a screenshot. The scene runs at
 * its densest tier, the brightest case. The background counted is the 95th-percentile pixel: the
 * near-brightest, so a single grain does not decide, but a band of lit sand would.
 */
const PHASES = [0, 1 / 6, 1 / 3, 1 / 2, 2 / 3, 5 / 6];
const TEXT = "main h1, main p, main nav a, footer p";

interface Measurement {
  text: string;
  phase: number;
  ratio: number;
  needed: number;
}

/** Relative luminance (WCAG) of the near-brightest pixel in a PNG, measured in the page. */
async function brightLuminance(page: Page, png: Buffer): Promise<number> {
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No 2D canvas to measure with.");
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    const linear = (channel: number) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    const luminances: number[] = [];
    for (let index = 0; index < data.length; index += 4) {
      luminances.push(
        0.2126 * linear(data[index] ?? 0) +
          0.7152 * linear(data[index + 1] ?? 0) +
          0.0722 * linear(data[index + 2] ?? 0),
      );
    }
    luminances.sort((a, b) => a - b);
    return luminances[Math.floor(0.95 * (luminances.length - 1))] ?? 0;
  }, png.toString("base64"));
}

test("keeps every text readable over the scene, in every light", async ({ page }) => {
  // Six lights, five texts each, at the densest tier in software WebGL: slow on the phone profile.
  test.setTimeout(300_000);
  await page.goto("/?quality=high&tune");
  await expect(page.locator("[data-scene]")).toHaveAttribute("data-state", "running");
  await page.getByText("Tune the scene").waitFor();
  const phaseInput = page.locator(".lil-controller", { hasText: "startPhase" }).locator("input");

  // Each text element's colour, size and box, read while it is visible.
  const elements = await page.locator(TEXT).evaluateAll((nodes) =>
    nodes.map((node) => {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      // Computed colours may come back as oklch(); painting one pixel converts them to sRGB.
      const pixel = document.createElement("canvas").getContext("2d");
      if (!pixel) throw new Error("No 2D canvas to read colours with.");
      pixel.fillStyle = style.color;
      pixel.fillRect(0, 0, 1, 1);
      const [red, green, blue] = pixel.getImageData(0, 0, 1, 1).data;
      return {
        text: node.textContent.trim().slice(0, 40),
        colour: [red ?? 0, green ?? 0, blue ?? 0],
        large:
          parseFloat(style.fontSize) >= 24 ||
          (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700),
        box: { x: box.x, y: box.y, width: box.width, height: box.height },
      };
    }),
  );
  const luminanceOf = ([red, green, blue]: number[]) => {
    const linear = (channel: number) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * linear(red ?? 0) + 0.7152 * linear(green ?? 0) + 0.0722 * linear(blue ?? 0);
  };

  await page.addStyleTag({
    content: `${TEXT} { color: transparent !important; text-decoration-color: transparent !important; }`,
  });
  const measurements: Measurement[] = [];
  for (const phase of PHASES) {
    await page.locator(".lil-gui").evaluate((panel) => (panel.style.visibility = "visible"));
    await phaseInput.fill(String(phase));
    await phaseInput.press("Enter");
    await page.locator(".lil-gui").evaluate((panel) => (panel.style.visibility = "hidden"));
    await page.waitForTimeout(400);
    for (const element of elements) {
      const background = await brightLuminance(page, await page.screenshot({ clip: element.box }));
      const text = luminanceOf(element.colour);
      const [lighter, darker] = [text, background].sort((a, b) => b - a) as [number, number];
      measurements.push({
        text: element.text,
        phase,
        ratio: Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100,
        needed: element.large ? 3 : 4.5,
      });
    }
  }
  for (const element of elements) {
    const lowest = Math.min(
      ...measurements.filter((m) => m.text === element.text).map((m) => m.ratio),
    );
    test.info().annotations.push({
      type: "lowest contrast",
      description: `${element.text}: ${String(lowest)}`,
    });
  }
  const failures = measurements.filter((measurement) => measurement.ratio < measurement.needed);
  expect(failures, JSON.stringify(measurements)).toEqual([]);
});
