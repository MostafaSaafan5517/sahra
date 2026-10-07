import {
  MathUtils,
  Mesh,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { createCamera, FAR_DEPTH, FIELD_OF_VIEW, NEAR_DEPTH } from "./camera";
import { createDuneGeometry, seededRandom } from "./dunes";
import { lightAt, SUN_GLOW } from "./lighting";
import { SCENE_SETTINGS } from "./settings";
import fragmentShader from "./shaders/dunes.frag.glsl?raw";
import duneVertexShader from "./shaders/dunes.vert.glsl?raw";
import noise from "./shaders/noise.glsl?raw";
import skyFragmentShader from "./shaders/sky.frag.glsl?raw";
import skyVertexShader from "./shaders/sky.vert.glsl?raw";
import type { Tunable } from "./tune";
import { GustField, GustTrail, listenForGusts, MAX_GUSTS } from "./wind";

/** Matches the page background (`bg-neutral-950`), so the canvas fades in without a seam. */
const BACKGROUND = 0x0a0a0a;
const MAX_PIXEL_RATIO = 2;

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
  const light = lightAt(SCENE_SETTINGS.startPhase);

  // The scene's clock, in seconds: starts at `startTime` with the first frame, then follows
  // performance.now(). Animation frames and pointer events both read it.
  let clockOrigin = performance.now();
  const sceneSeconds = (nowMs: number) => SCENE_SETTINGS.startTime + (nowMs - clockOrigin) / 1000;

  // Shared by the sky and the dunes; colours are display (sRGB) values the shaders write out as is.
  const time = { value: 0 };
  const horizon = { value: new Vector3() };

  const duneUniforms = {
    uTime: time,
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
    uSandLit: { value: new Vector3() },
    uSandShade: { value: new Vector3() },
    uSun: { value: new Vector2() },
    uHorizon: horizon,
    uOpacity: { value: 0.9 },
  };
  const dunes = new Points(
    createDuneGeometry(
      SCENE_SETTINGS.lines,
      SCENE_SETTINGS.pointsPerLine,
      seededRandom(SCENE_SETTINGS.seed),
    ),
    new ShaderMaterial({
      vertexShader: `${noise}\n${duneVertexShader}`,
      fragmentShader,
      uniforms: duneUniforms,
      defines: { MAX_GUSTS },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  // The positions are layout codes for the shader, not places, so culling by them would be wrong.
  dunes.frustumCulled = false;

  const skyUniforms = {
    uTime: time,
    uSkyTop: { value: new Vector3() },
    uHorizon: horizon,
    uGround: { value: new Vector3() },
    uHorizonY: { value: 0.5 },
    uSun: duneUniforms.uSun,
    uSunGlow: { value: SUN_GLOW },
  };
  const sky = new Mesh(
    new PlaneGeometry(2, 2),
    new ShaderMaterial({
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
      uniforms: skyUniforms,
      depthTest: false,
      depthWrite: false,
    }),
  );
  // A full-screen quad in clip space: always on screen, and drawn before the dunes.
  sky.frustumCulled = false;
  sky.renderOrder = -1;

  const scene = new Scene();
  scene.add(sky, dunes);

  function resize(): void {
    const { clientWidth: width, clientHeight: height } = canvas;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    duneUniforms.uAspect.value = camera.aspect;
    // Where the farthest sand meets the sky, on screen (0 bottom, 1 top).
    skyUniforms.uHorizonY.value = new Vector3(0, 0, -FAR_DEPTH).project(camera).y * 0.5 + 0.5;
  }
  resize();
  new ResizeObserver(resize).observe(canvas);

  // The light cycle: phase = phaseStart + seconds / cycleSeconds, wrapped by lightAt. At the
  // clock's start it is `startPhase`.
  let cycleSeconds = SCENE_SETTINGS.cycleSeconds;
  let phaseStart = SCENE_SETTINGS.startPhase - SCENE_SETTINGS.startTime / cycleSeconds;
  const phaseAt = (seconds: number) => phaseStart + seconds / cycleSeconds;

  function render(timeMs: number): void {
    const seconds = sceneSeconds(timeMs);
    time.value = seconds;
    lightAt(phaseAt(seconds), light);
    duneUniforms.uSandLit.value.fromArray(light.sandLit);
    duneUniforms.uSandShade.value.fromArray(light.sandShade);
    duneUniforms.uSun.value.fromArray(light.sun);
    horizon.value.fromArray(light.horizon);
    skyUniforms.uSkyTop.value.fromArray(light.skyTop);
    skyUniforms.uGround.value.fromArray(light.ground);
    renderer.render(scene, camera);
  }

  // Compiles the shaders without blocking the main thread where the browser supports it.
  await renderer.compileAsync(scene, camera);
  clockOrigin = performance.now();
  render(clockOrigin);
  if (!animate) return;
  renderer.setAnimationLoop(render);
  // A slot is reused only after its gust has settled, so the sand never snaps back early.
  const trail = new GustTrail(camera, gusts, SCENE_SETTINGS.gustLife / MAX_GUSTS);
  listenForGusts(trail, () => sceneSeconds(performance.now()));

  if (!new URLSearchParams(location.search).has("tune")) return;
  const uniformTunable = (
    name: string,
    min: number,
    max: number,
    step: number,
    uniform: { value: number },
  ): Tunable => ({ name, min, max, step, apply: (value) => (uniform.value = value) });
  const nowSeconds = () => sceneSeconds(performance.now());
  const tunables: Tunable[] = [
    uniformTunable("windSpeed", 0, 2, 0.01, duneUniforms.uWindSpeed),
    uniformTunable("flowStrength", 0, 0.6, 0.01, duneUniforms.uFlowStrength),
    uniformTunable("duneHeight", 0, 2.5, 0.05, duneUniforms.uDuneHeight),
    uniformTunable("pointSize", 0.5, 6, 0.1, duneUniforms.uPointSize),
    uniformTunable("gustStrength", 0, 3, 0.05, duneUniforms.uGustStrength),
    uniformTunable("gustRadius", 0.2, 4, 0.05, duneUniforms.uGustRadius),
    {
      name: "gustLife",
      min: 0.6,
      max: 6,
      step: 0.1,
      apply: (value) => {
        duneUniforms.uGustLife.value = value;
        trail.interval = value / MAX_GUSTS;
      },
    },
    {
      // Changing the length keeps the current light where it is.
      name: "cycleSeconds",
      min: 20,
      max: 1200,
      step: 10,
      apply: (value) => {
        const phase = phaseAt(nowSeconds());
        cycleSeconds = value;
        phaseStart = phase - nowSeconds() / cycleSeconds;
      },
    },
    {
      // Jumps the light to a point of the cycle (0 dawn, 0.33 midday, 0.67 dusk); it moves on from there.
      name: "startPhase",
      min: 0,
      max: 1,
      step: 0.01,
      apply: (value) => {
        phaseStart = value - nowSeconds() / cycleSeconds;
      },
    },
  ];
  import("./tune").then(
    ({ openTuningPanel }) => {
      openTuningPanel(SCENE_SETTINGS, tunables);
    },
    (error: unknown) => {
      console.error("The tuning panel failed to load", error);
    },
  );
}
