import { PerspectiveCamera, Points, Scene, ShaderMaterial, WebGLRenderer } from "three";
import { createGrid } from "./grid";
import fragmentShader from "./shaders/points.frag.glsl?raw";
import vertexShader from "./shaders/points.vert.glsl?raw";

/** Matches the page background (`bg-neutral-950`), so the canvas fades in without a seam. */
const BACKGROUND = 0x0a0a0a;
const MAX_PIXEL_RATIO = 2;
const COLUMNS = 200;
const ROWS = 60;

interface SceneOptions {
  /** False renders a single still frame, for visitors who prefer reduced motion. */
  animate: boolean;
}

/**
 * Starts the scene on a canvas whose WebGL2 context the caller already created
 * (creating it first is how the caller learns WebGL2 works before downloading Three.js).
 * Resolves once the first frame is on screen.
 */
export async function startScene(
  canvas: HTMLCanvasElement,
  context: WebGL2RenderingContext,
  { animate }: SceneOptions,
): Promise<void> {
  const renderer = new WebGLRenderer({ canvas, context });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.setClearColor(BACKGROUND);

  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 1.2, 6);
  camera.lookAt(0, 0, 0);

  const uniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
  };
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const scene = new Scene();
  scene.add(new Points(createGrid(COLUMNS, ROWS), material));

  function resize(): void {
    const { clientWidth: width, clientHeight: height } = canvas;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(canvas);

  // Compiles the shaders without blocking the main thread where the browser supports it.
  await renderer.compileAsync(scene, camera);

  function render(timeMs: number): void {
    uniforms.uTime.value = timeMs / 1000;
    renderer.render(scene, camera);
  }
  render(performance.now());
  if (animate) renderer.setAnimationLoop(render);
}
