/**
 * Says which version of the home page Lighthouse measured in each run: the live scene (its script
 * was downloaded) or the poster (no Three.js: no WebGL2, or WebGL only in software, as on CI
 * machines without a GPU). Fails when the home page's runs disagree, or when LIGHTHOUSE_EXPECTS
 * ("scene" or "poster") is set and a run measured the other one, so a score can never quietly come
 * from the wrong page. Every other page (the Lab) must never download the scene.
 */
import { readdirSync, readFileSync } from "node:fs";

const RESULTS_DIR = ".lighthouseci";
const SCENE_CHUNK = /\/assets\/scene-[\w-]+\.js$/;
const HOME_PATHS = new Set(["/", "/index.html"]);

interface LighthouseRun {
  requestedUrl: string;
  audits: { "network-requests"?: { details?: { items?: { url: string }[] } } };
}

const runs = readdirSync(RESULTS_DIR)
  .filter((file) => file.startsWith("lhr-") && file.endsWith(".json"))
  .map((file) => JSON.parse(readFileSync(`${RESULTS_DIR}/${file}`, "utf8")) as LighthouseRun);
if (runs.length === 0) {
  console.error(`No Lighthouse results in ${RESULTS_DIR}/. Run \`lhci collect\` first.`);
  process.exit(1);
}

const loadedScene = (run: LighthouseRun) =>
  (run.audits["network-requests"]?.details?.items ?? []).some((request) =>
    SCENE_CHUNK.test(request.url),
  );
const isHome = (run: LighthouseRun) => HOME_PATHS.has(new URL(run.requestedUrl).pathname);

const otherPages = runs.filter((run) => !isHome(run));
const otherWithScene = otherPages.filter(loadedScene);
if (otherWithScene.length > 0) {
  const pages = new Set(otherWithScene.map((run) => new URL(run.requestedUrl).pathname));
  console.error(`Only the home page may load the scene; it loaded on ${[...pages].join(", ")}.`);
  process.exit(1);
}

const paths = runs.filter(isHome).map((run) => (loadedScene(run) ? "scene" : "poster"));
if (paths.length === 0) {
  console.error("Lighthouse did not measure the home page.");
  process.exit(1);
}
const measured = new Set(paths);
const expected = process.env.LIGHTHOUSE_EXPECTS;

if (measured.size > 1) {
  console.error(`The home page's Lighthouse runs measured different pages: ${paths.join(", ")}.`);
  process.exit(1);
}
const [path] = paths as [string];
if (expected && path !== expected) {
  console.error(`Lighthouse measured the ${path} in every run; expected the ${expected}.`);
  process.exit(1);
}
console.info(
  path === "scene"
    ? `Lighthouse measured the live scene in all ${String(paths.length)} runs of the home page.`
    : `Lighthouse measured the poster (no Three.js) in all ${String(paths.length)} runs of the home page.`,
);
console.info(`The other pages' ${String(otherPages.length)} runs never loaded the scene.`);
