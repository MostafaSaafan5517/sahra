import { Color, MathUtils, Points, Scene, ShaderMaterial, WebGLRenderer } from "three";
import { createCamera, FAR_DEPTH, FIELD_OF_VIEW, NEAR_DEPTH } from "./camera";
import { createDuneGeometry, seededRandom } from "./dunes";
import { SCENE_SETTINGS } from "./settings";
import fragmentShader from "./shaders/dunes.frag.glsl?raw";
import duneVertexShader from "./shaders/dunes.vert.glsl?raw";
import noise from "./shaders/noise.glsl?raw";
import { GustField, GustTrail, listenForGusts, MAX_GUSTS } from "./wind";

/** Matches the page background (`bg-neutral-950`), so the canvas fades in without a seam. */
const BACKGROUND = 0x0a0a0a;
const MAX_PIXEL_RATIO = 2;
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

  const camera = createCamera(1);
  const gusts = new GustField();

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
    uGustOrigins: { value: gusts.origins },
    uGustDirections: { value: gusts.directions },
    uGustStrength: { value: SCENE_SETTINGS.gustStrength },
    uGustRadius: { value: SCENE_SETTINGS.gustRadius },
    uGustLife: { value: SCENE_SETTINGS.gustLife },
    uColor: { value: SAND_COLOR },
    uOpacity: { value: 0.9 },
  };
  const material = new ShaderMaterial({
    vertexShader: `${noise}\n${duneVertexShader}`,
    fragmentShader,
    uniforms,
    defines: { MAX_GUSTS },
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
  if (!animate) return;
  renderer.setAnimationLoop(render);
  // A slot is reused only after its gust has settled, so the sand never snaps back early.
  const trail = new GustTrail(camera, gusts, SCENE_SETTINGS.gustLife / MAX_GUSTS);
  listenForGusts(trail);

  if (new URLSearchParams(location.search).has("tune")) {
    import("./tune").then(
      ({ openTuningPanel }) => {
        openTuningPanel(SCENE_SETTINGS, [
          {
            name: "windSpeed",
            min: 0,
            max: 2,
            step: 0.01,
            apply: (value) => (uniforms.uWindSpeed.value = value),
          },
          {
            name: "flowStrength",
            min: 0,
            max: 0.6,
            step: 0.01,
            apply: (value) => (uniforms.uFlowStrength.value = value),
          },
          {
            name: "duneHeight",
            min: 0,
            max: 2.5,
            step: 0.05,
            apply: (value) => (uniforms.uDuneHeight.value = value),
          },
          {
            name: "pointSize",
            min: 0.5,
            max: 6,
            step: 0.1,
            apply: (value) => (uniforms.uPointSize.value = value),
          },
          {
            name: "gustStrength",
            min: 0,
            max: 3,
            step: 0.05,
            apply: (value) => (uniforms.uGustStrength.value = value),
          },
          {
            name: "gustRadius",
            min: 0.2,
            max: 4,
            step: 0.05,
            apply: (value) => (uniforms.uGustRadius.value = value),
          },
          {
            name: "gustLife",
            min: 0.6,
            max: 6,
            step: 0.1,
            apply: (value) => {
              uniforms.uGustLife.value = value;
              trail.interval = value / MAX_GUSTS;
            },
          },
        ]);
      },
      (error: unknown) => {
        console.error("The tuning panel failed to load", error);
      },
    );
  }
}
