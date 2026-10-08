import { resolve } from "node:path";
import { defineConfig } from "vite";
import { siteName } from "./vite.config.ts";

/**
 * The embed (src/embed/sahra.ts) and its demo page (embed/index.html), built into dist/embed/
 * after the site (`pnpm build` runs both). Other sites load `embed/sahra.js` from this site's
 * domain, so:
 * - its name never changes (no hash), and the other files have hashed names;
 * - every path between them is relative (`base: "./"`), resolved against the script's own URL,
 *   never against the page that embeds it;
 * - there is no modulepreload helper, which would add links to the embedding page.
 */
export default defineConfig({
  root: resolve(import.meta.dirname, "embed"),
  base: "./",
  plugins: [siteName()],
  build: {
    outDir: resolve(import.meta.dirname, "dist/embed"),
    // The site's build has just filled dist/; this one only adds dist/embed/.
    emptyOutDir: false,
    modulePreload: false,
    // Three.js's WebGLRenderer is about 520 kB minified (130 kB gzipped), in the scene's own chunk.
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      input: {
        sahra: resolve(import.meta.dirname, "src/embed/sahra.ts"),
        demo: resolve(import.meta.dirname, "embed/index.html"),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "sahra" ? "sahra.js" : "assets/[name]-[hash].js",
        chunkFileNames: "assets/sahra-[name]-[hash].js",
      },
    },
  },
  server: { port: 3304, strictPort: true },
});
