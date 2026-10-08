/**
 * Fails when a file the page downloads grows past its budget. Scripts and styles are measured
 * gzipped, as they are served; the posters as they are (WebP does not shrink further).
 *
 * CI's Lighthouse runs on machines without a GPU, where the page shows the poster and never
 * downloads the scene. These budgets keep the scene's weight (and the rest of the page's) in
 * check there instead. Run after `pnpm build`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const ASSETS_DIR = "dist/assets";

interface Budget {
  name: string;
  file: RegExp;
  maxKb: number;
  gzip: boolean;
}

const BUDGETS: Budget[] = [
  { name: "page script", file: /^index-[\w-]+\.js$/, maxKb: 5, gzip: true },
  { name: "styles", file: /^index-[\w-]+\.css$/, maxKb: 15, gzip: true },
  { name: "scene (Three.js and shaders)", file: /^scene-[\w-]+\.js$/, maxKb: 145, gzip: true },
  { name: "font", file: /^instrument-sans-latin-wght-[\w-]+\.woff2$/, maxKb: 35, gzip: false },
  { name: "phone poster", file: /^poster-portrait-860-[\w-]+\.webp$/, maxKb: 100, gzip: false },
  { name: "laptop poster", file: /^poster-landscape-1440-[\w-]+\.webp$/, maxKb: 80, gzip: false },
];

const files = readdirSync(ASSETS_DIR);
let failed = false;
for (const budget of BUDGETS) {
  const matches = files.filter((file) => budget.file.test(file));
  if (matches.length !== 1) {
    console.error(
      `${budget.name}: expected one file matching ${String(budget.file)}, found ${String(matches.length)}`,
    );
    failed = true;
    continue;
  }
  const [file] = matches as [string];
  const bytes = readFileSync(`${ASSETS_DIR}/${file}`);
  const kb = (budget.gzip ? gzipSync(bytes).length : bytes.length) / 1024;
  const over = kb > budget.maxKb;
  failed ||= over;
  const line = `${over ? "OVER" : "ok  "}  ${budget.name}: ${kb.toFixed(1)} kB${budget.gzip ? " gzipped" : ""} (budget ${String(budget.maxKb)} kB)  ${file}`;
  if (over) console.error(line);
  else console.info(line);
}
if (failed) process.exit(1);
