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
  server: { port: 3300, strictPort: true },
  preview: { port: 3301, strictPort: true },
});
