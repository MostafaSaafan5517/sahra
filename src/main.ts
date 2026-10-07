import "./style.css";
import { isSoftwareRenderer, rendererName } from "./scene/quality";

/** Points need no depth buffer, stencil or antialiasing; an opaque canvas composites cheaper. */
const CONTEXT_ATTRIBUTES: WebGLContextAttributes = {
  alpha: false,
  antialias: false,
  depth: false,
  stencil: false,
};
/** How long the canvas takes to fade in or out (`duration-1000` on it). */
const CANVAS_FADE_MS = 1000;

const sceneContainer = document.querySelector<HTMLElement>("[data-scene]");
if (sceneContainer) {
  whenPageIsIdle(() => void mountScene(sceneContainer));
}

/**
 * Runs the task after the page has loaded and the browser is idle, so the scene's
 * download and startup never compete with the content's first paint.
 */
function whenPageIsIdle(task: () => void): void {
  const schedule = () => {
    if ("requestIdleCallback" in window) requestIdleCallback(task, { timeout: 1000 });
    else setTimeout(task, 0);
  };
  if (document.readyState === "complete") schedule();
  else addEventListener("load", schedule, { once: true });
}

/**
 * A WebGL2 context fit for the scene, or why there is none. Without a GPU, browsers can still
 * offer WebGL by drawing in software (SwiftShader and the like). That is slow and makes the whole
 * page sluggish, so it counts as low power: the poster stays and Three.js is never downloaded.
 * `failIfMajorPerformanceCaveat` is the standard way to ask for this; the renderer's name is a
 * second check for browsers that ignore it. `?quality` in the URL (any value) asks for the scene
 * anyway, for tests, recordings and comparisons.
 */
function createSceneContext(
  canvas: HTMLCanvasElement,
  sceneRequested: boolean,
): WebGL2RenderingContext | "unsupported" | "low-power" {
  const context = canvas.getContext("webgl2", {
    ...CONTEXT_ATTRIBUTES,
    failIfMajorPerformanceCaveat: !sceneRequested,
  });
  if (context) {
    if (sceneRequested || !isSoftwareRenderer(rendererName(context))) return context;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return "low-power";
  }
  // No fast context: a throwaway canvas tells "software only" from "no WebGL2 at all".
  const probe = document.createElement("canvas").getContext("webgl2");
  probe?.getExtension("WEBGL_lose_context")?.loseContext();
  return probe ? "low-power" : "unsupported";
}

/**
 * Adds the scene to the container and records its state in `data-state`: `unsupported` (no
 * WebGL2), `low-power` (WebGL only in software, or too slow even at the lightest quality),
 * `running` (on screen), `failed` (could not start) or `lost` (WebGL taken away for now). CSS
 * shows the canvas only while `running`; otherwise the poster beneath it shows.
 */
async function mountScene(container: HTMLElement): Promise<void> {
  const canvas = document.createElement("canvas");
  const context = createSceneContext(canvas, new URLSearchParams(location.search).has("quality"));
  if (typeof context === "string") {
    container.dataset.state = context;
    return;
  }

  canvas.className =
    "absolute inset-0 size-full opacity-0 group-data-[state=running]:opacity-100 motion-safe:transition-opacity motion-safe:duration-1000";
  container.append(canvas);
  try {
    const { startScene } = await import("./scene/scene");
    const scene = await startScene(canvas, context, {
      animate: !matchMedia("(prefers-reduced-motion: reduce)").matches,
      onStateChange: (state) => {
        container.dataset.state = state;
        if (state !== "low-power") return;
        // The canvas fades out to the poster; then the scene is released for good.
        setTimeout(() => {
          scene.stop();
          canvas.remove();
        }, CANVAS_FADE_MS);
      },
    });
    container.dataset.state = "running";
  } catch (error) {
    canvas.remove();
    container.dataset.state = "failed";
    console.error("The scene failed to start", error);
  }
}
