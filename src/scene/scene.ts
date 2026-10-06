import {
  Color,
  MathUtils,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from "three";
import { createDuneGeometry, seededRandom } from "./dunes";
import { SCENE_SETTINGS } from "./settings";
import fragmentShader from "./shaders/dunes.frag.glsl?raw";
import duneVertexShader from "./shaders/dunes.vert.glsl?raw";
import noise from "./shaders/noise.glsl?raw";

/** Matches the page background (`bg-neutral-950`), so the canvas fades in without a seam. */
const BACKGROUND = 0x0a0a0a;
const MAX_PIXEL_RATIO = 2;
const FIELD_OF_VIEW = 35;
/** The camera stands this high above the sand and looks at the ground this far ahead. */
const CAMERA_HEIGHT = 1.4;
const LOOK_DISTANCE = 12;
/** Distance from the camera to the nearest and the farthest dune line. */
const NEAR_DEPTH = 1.2;
const FAR_DEPTH = 40;
/** Display (sRGB) values: the fragment shader writes them out unchanged. */
const SAND_COLOR = new Color(0.85, 0.77, 0.63);

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

  const camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, FAR_DEPTH * 2);
  camera.position.set(0, CAMERA_HEIGHT, 0);
  camera.lookAt(0, 0, -LOOK_DISTANCE);

  const uniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uAspect: { value: 1 },
    uTanHalfFov: { value: Math.tan(MathUtils.degToRad(FIELD_OF_VIEW / 2)) },
    uNearDepth: { value: NEAR_DEPTH },
    uFarDepth: { value: FAR_DEPTH },
    uWindSpeed: { value: SCENE_SETTINGS.windSpeed },
    uFlowStrength: { value: SCENE_SETTINGS.flowStrength },
    uDuneHeight: { value: SCENE_SETTINGS.duneHeight },
    uPointSize: { value: SCENE_SETTINGS.pointSize },
    uColor: { value: SAND_COLOR },
    uOpacity: { value: 0.9 },
  };
  const material = new ShaderMaterial({
    vertexShader: `${noise}\n${duneVertexShader}`,
    fragmentShader,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const dunes = new Points(
    createDuneGeometry(
      SCENE_SETTINGS.lines,
      SCENE_SETTINGS.pointsPerLine,
      seededRandom(SCENE_SETTINGS.seed),
    ),
    material,
  );
  // The positions are layout codes for the shader, not places, so culling by them would be wrong.
  dunes.frustumCulled = false;
  const scene = new Scene();
  scene.add(dunes);

  function resize(): void {
    const { clientWidth: width, clientHeight: height } = canvas;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    uniforms.uAspect.value = camera.aspect;
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
