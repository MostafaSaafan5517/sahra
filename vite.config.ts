import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import { SITE_NAME } from "./src/config.ts";
import { patternSvg } from "./src/lab/pattern.ts";

/** Writes the site name into every HTML page at build time, so it lives in one constant. */
export function siteName(): Plugin {
  return {
    name: "sahra:site-name",
    transformIndexHtml: (html) => html.replaceAll("%SITE_NAME%", SITE_NAME),
  };
}

/** Writes the Lab's line drawing into `lab/index.html` as plain SVG, so no script draws it. */
function labPattern(): Plugin {
  return {
    name: "sahra:lab-pattern",
    transformIndexHtml: (html) => html.replace("%LAB_PATTERN%", patternSvg()),
  };
}

export default defineConfig({
  plugins: [tailwindcss(), siteName(), labPattern()],
  build: {
    // Every browser with WebGL2 and the CSS this site uses also supports modulepreload; the
    // polyfill would only add a shared script request to both pages.
    modulePreload: { polyfill: false },
    rolldownOptions: {
      input: {
        home: resolve(import.meta.dirname, "index.html"),
        lab: resolve(import.meta.dirname, "lab/index.html"),
      },
      // What both pages load lands in one chunk under a plain name, `shared-*` (.js and .css):
      // the styles, the idle helper and Vite's preload helper for loading chunks on demand.
      output: {
        codeSplitting: {
          groups: [
            {
              name: "shared",
              test: /vite\/preload-helper|\/src\/(style\.css|when-idle\.ts)$/,
            },
          ],
        },
      },
    },
    // Three.js's WebGLRenderer is about 520 kB minified (130 kB gzipped). It sits in its own
    // chunk that loads only after first paint; the warning stays on for anything bigger.
    chunkSizeWarningLimit: 600,
  },
  server: { port: 3300, strictPort: true },
  preview: { port: 3301, strictPort: true },
});
