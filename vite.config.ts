import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import { SITE_NAME } from "./src/config.ts";

/** Writes the site name into every HTML page at build time, so it lives in one constant. */
function siteName(): Plugin {
  return {
    name: "sahra:site-name",
    transformIndexHtml: (html) => html.replaceAll("%SITE_NAME%", SITE_NAME),
  };
}

export default defineConfig({
  plugins: [tailwindcss(), siteName()],
  build: {
    // Three.js's WebGLRenderer is about 520 kB minified (130 kB gzipped). It sits in its own
    // chunk that loads only after first paint; the warning stays on for anything bigger.
    chunkSizeWarningLimit: 600,
  },
  server: { port: 3300, strictPort: true },
  preview: { port: 3301, strictPort: true },
});
