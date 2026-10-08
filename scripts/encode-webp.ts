import type { Page } from "@playwright/test";

/**
 * Re-encodes a PNG screenshot as WebP at the given width and quality (0 to 1), using the browser's
 * own encoder: no image library to install.
 */
export async function encodeWebp(
  page: Page,
  png: Buffer,
  width: number,
  quality: number,
): Promise<Buffer> {
  const base64 = await page.evaluate(
    async ({ source, width, quality }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${source}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = Math.round((image.height * width) / image.width);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No 2D canvas to encode with.");
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/webp", quality);
      });
      if (!blob) throw new Error("The browser could not encode WebP.");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary);
    },
    { source: png.toString("base64"), width, quality },
  );
  return Buffer.from(base64, "base64");
}
