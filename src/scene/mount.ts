import { isSoftwareRenderer, rendererName } from "./quality";
import type { SceneHandle, SceneOptions } from "./scene";

/** Points need no depth buffer, stencil or antialiasing; an opaque canvas composites cheaper. */
const CONTEXT_ATTRIBUTES: WebGLContextAttributes = {
  alpha: false,
  antialias: false,
  depth: false,
  stencil: false,
};
/** How long the canvas takes to fade in or out. */
const CANVAS_FADE_MS = 1000;

/**
 * A WebGL2 context fit for the scene, or why there is none. Without a GPU, browsers can still
 * offer WebGL by drawing in software (SwiftShader and the like). That is slow and makes the whole
 * page sluggish, so it counts as low power: the scene does not start and Three.js is never
 * downloaded. `failIfMajorPerformanceCaveat` is the standard way to ask for this; the renderer's
 * name is a second check for browsers that ignore it. `force` asks for the scene anyway, for
 * tests, recordings and comparisons.
 */
function createSceneContext(
  canvas: HTMLCanvasElement,
  force: boolean,
): WebGL2RenderingContext | "unsupported" | "low-power" {
  const context = canvas.getContext("webgl2", {
    ...CONTEXT_ATTRIBUTES,
    failIfMajorPerformanceCaveat: !force,
  });
  if (context) {
    if (force || !isSoftwareRenderer(rendererName(context))) return context;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return "low-power";
  }
  // No fast context: a throwaway canvas tells "software only" from "no WebGL2 at all".
  const probe = document.createElement("canvas").getContext("webgl2");
  probe?.getExtension("WEBGL_lose_context")?.loseContext();
  return probe ? "low-power" : "unsupported";
}

export interface MountOptions {
  /**
   * Run the scene even on software-only WebGL (the home page's `?quality`, an embed's
   * `data-quality`).
   */
  force: boolean;
  /** Passed on to the scene. */
  scene: Omit<SceneOptions, "animate" | "onStateChange">;
  /** The positioned element the canvas covers; the container itself unless given. */
  layer?: HTMLElement;
}

/**
 * Adds the scene to the container (or the layer given), which must be positioned, as the canvas
 * covers it, and records the scene's state in the container's `data-state`: `unsupported` (no
 * WebGL2), `low-power` (WebGL only in software, or too slow even at the lightest quality),
 * `running` (on screen), `failed` (could not start) or `lost` (WebGL taken away for now). The
 * canvas shows only while `running`, fading in over whatever the container shows beneath it (the
 * home page's poster, an embed's background).
 * Resolves with the scene, or nothing when it did not start; once it has gone low power, the
 * scene stops and its canvas is removed by itself.
 */
export async function mountScene(
  container: HTMLElement,
  { force, scene: sceneOptions, layer = container }: MountOptions,
): Promise<SceneHandle | undefined> {
  const canvas = document.createElement("canvas");
  const context = createSceneContext(canvas, force);
  if (typeof context === "string") {
    container.dataset.state = context;
    return undefined;
  }

  const animate = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  Object.assign(canvas.style, {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    opacity: "0",
    transition: animate ? `opacity ${String(CANVAS_FADE_MS)}ms` : "",
  });
  const showState = (state: string) => {
    container.dataset.state = state;
    canvas.style.opacity = state === "running" ? "1" : "0";
  };
  layer.append(canvas);
  try {
    const { startScene } = await import("./scene");
    const scene = await startScene(canvas, context, {
      ...sceneOptions,
      animate,
      onStateChange: (state) => {
        showState(state);
        if (state !== "low-power") return;
        // The canvas fades out; then the scene is released for good.
        setTimeout(() => {
          scene.stop();
          canvas.remove();
        }, CANVAS_FADE_MS);
      },
    });
    showState("running");
    return scene;
  } catch (error) {
    canvas.remove();
    container.dataset.state = "failed";
    console.error("The scene failed to start", error);
    return undefined;
  }
}
