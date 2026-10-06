/**
 * Fails unless the scene ran in every Lighthouse run. Lighthouse's Chrome has no GPU in CI; if
 * WebGL ever stopped working there, Three.js would never download and the scores would flatter
 * the page. The scene chunk is only requested after a WebGL2 context was created, so its presence
 * in a run's network requests proves the scene's real cost was measured.
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

const runsWithoutScene = runs.filter(
  (run) =>
    !(run.audits["network-requests"]?.details?.items ?? []).some((request) =>
      SCENE_CHUNK.test(request.url),
    ),
);

if (runs.length === 0) {
  console.error(`No Lighthouse results in ${RESULTS_DIR}/. Run \`lhci collect\` first.`);
  process.exit(1);
}
if (runsWithoutScene.length > 0) {
  console.error(
    `The scene did not load in ${String(runsWithoutScene.length)} of ${String(runs.length)} Lighthouse runs:`,
    runsWithoutScene.map((run) => run.requestedUrl),
  );
  process.exit(1);
}
console.info(`The scene loaded in all ${String(runs.length)} Lighthouse runs.`);
