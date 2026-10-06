import "./style.css";

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
 * Adds the scene to the container and records the outcome in its `data-state`:
 * `unsupported` (no WebGL2), `running` (first frame on screen) or `failed`.
 * CSS reads the state to fade the canvas in.
 */
async function mountScene(container: HTMLElement): Promise<void> {
  const canvas = document.createElement("canvas");
  // Points need no depth buffer, stencil or antialiasing; an opaque canvas composites cheaper.
  const context = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
  });
  // Without WebGL2 the page simply stays as it is; Three.js is never downloaded.
  if (!context) {
    container.dataset.state = "unsupported";
    return;
  }

  canvas.className =
    "block size-full opacity-0 group-data-[state=running]:opacity-100 motion-safe:transition-opacity motion-safe:duration-1000";
  container.append(canvas);
  try {
    const { startScene } = await import("./scene/scene");
    await startScene(canvas, context, {
      animate: !matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
    container.dataset.state = "running";
  } catch (error) {
    canvas.remove();
    container.dataset.state = "failed";
    console.error("The scene failed to start", error);
  }
}
