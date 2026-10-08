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
  /** The folder the file is in; the hashed build assets unless given. */
  dir?: string;
  file: RegExp;
  maxKb: number;
  gzip: boolean;
}

const BUDGETS: Budget[] = [
  { name: "home page script", file: /^home-[\w-]+\.js$/, maxKb: 5, gzip: true },
  { name: "styles (both pages)", file: /^shared-[\w-]+\.css$/, maxKb: 15, gzip: true },
  { name: "shared script (both pages)", file: /^shared-[\w-]+\.js$/, maxKb: 2, gzip: true },
  { name: "scene (Three.js and shaders)", file: /^scene-[\w-]+\.js$/, maxKb: 145, gzip: true },
  { name: "font", file: /^instrument-sans-latin-wght-[\w-]+\.woff2$/, maxKb: 35, gzip: false },
  { name: "phone poster", file: /^poster-portrait-860-[\w-]+\.webp$/, maxKb: 100, gzip: false },
  { name: "laptop poster", file: /^poster-landscape-1440-[\w-]+\.webp$/, maxKb: 80, gzip: false },
  {
    name: "Lab page, with its drawing",
    dir: "dist/lab",
    file: /^index\.html$/,
    maxKb: 8,
    gzip: true,
  },
  { name: "Lab script", file: /^lab-[\w-]+\.js$/, maxKb: 2, gzip: true },
  { name: "Lab styles", file: /^lab-[\w-]+\.css$/, maxKb: 2, gzip: true },
  { name: "Lab scroll story (GSAP)", file: /^story-[\w-]+\.js$/, maxKb: 50, gzip: true },
  // What another site loads: the loader at once, the scene only where it can run.
  { name: "embed loader", dir: "dist/embed", file: /^sahra\.js$/, maxKb: 5, gzip: true },
  {
    name: "embed scene (Three.js and shaders)",
    dir: "dist/embed/assets",
    file: /^sahra-scene-[\w-]+\.js$/,
    maxKb: 145,
    gzip: true,
  },
  // Midday is the busiest picture of the day, so the largest file at each width.
  { name: "Lab still, phone", file: /^midday-720-[\w-]+\.webp$/, maxKb: 60, gzip: false },
  { name: "Lab still, laptop", file: /^midday-1440-[\w-]+\.webp$/, maxKb: 140, gzip: false },
];

let failed = false;
for (const budget of BUDGETS) {
  const dir = budget.dir ?? ASSETS_DIR;
  const matches = readdirSync(dir).filter((file) => budget.file.test(file));
  if (matches.length !== 1) {
    console.error(
      `${budget.name}: expected one file matching ${String(budget.file)}, found ${String(matches.length)}`,
    );
    failed = true;
    continue;
  }
  const [file] = matches as [string];
  const bytes = readFileSync(`${dir}/${file}`);
  const kb = (budget.gzip ? gzipSync(bytes).length : bytes.length) / 1024;
  const over = kb > budget.maxKb;
  failed ||= over;
  const line = `${over ? "OVER" : "ok  "}  ${budget.name}: ${kb.toFixed(1)} kB${budget.gzip ? " gzipped" : ""} (budget ${String(budget.maxKb)} kB)  ${file}`;
  if (over) console.error(line);
  else console.info(line);
}
if (failed) process.exit(1);
