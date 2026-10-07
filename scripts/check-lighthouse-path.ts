/**
 * Says which page Lighthouse measured in each run: the live scene (its script was downloaded) or
 * the poster (no Three.js: no WebGL2, or WebGL only in software, as on CI machines without a GPU).
 * Fails when the runs disagree, or when LIGHTHOUSE_EXPECTS ("scene" or "poster") is set and a run
 * measured the other one, so a score can never quietly come from the wrong page.
 */
import { readdirSync, readFileSync } from "node:fs";

const RESULTS_DIR = ".lighthouseci";
const SCENE_CHUNK = /\/assets\/scene-[\w-]+\.js$/;

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

const paths = runs.map((run) =>
  (run.audits["network-requests"]?.details?.items ?? []).some((request) =>
    SCENE_CHUNK.test(request.url),
  )
    ? "scene"
    : "poster",
);
const measured = new Set(paths);
const expected = process.env.LIGHTHOUSE_EXPECTS;

if (measured.size > 1) {
  console.error(`The Lighthouse runs measured different pages: ${paths.join(", ")}.`);
  process.exit(1);
}
const [path] = paths as [string];
if (expected && path !== expected) {
  console.error(`Lighthouse measured the ${path} in every run; expected the ${expected}.`);
  process.exit(1);
}
console.info(
  path === "scene"
    ? `Lighthouse measured the live scene in all ${String(runs.length)} runs.`
    : `Lighthouse measured the poster (no Three.js) in all ${String(runs.length)} runs.`,
);
