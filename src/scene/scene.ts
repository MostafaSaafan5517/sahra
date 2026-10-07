import {
  BufferGeometry,
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
import { FrameMonitor } from "./frame-monitor";
import { lightAt, SUN_GLOW } from "./lighting";
import { initialTier, QUALITY_TIERS, qualityTier, readDeviceSignals } from "./quality";
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
const LIGHTEST_TIER = QUALITY_TIERS.length - 1;
/**
 * Frame budgets for the 75th-percentile frame. Above 22 ms (below about 45 fps) the scene steps
 * down a tier. At the lightest tier it gives up for the poster only above 40 ms (below about
 * 25 fps): a steady 45 fps scene is still far better than none. (Software-only WebGL never gets
 * this far: main.ts shows the poster instead, unless `?quality` asks for the scene.)
 */
const STEP_DOWN_BUDGET_MS = 22;
const GIVE_UP_BUDGET_MS = 40;

/**
 * Changes after the scene has started: `lost` when the browser takes WebGL away (phones do under
 * memory pressure), `running` again when it gives it back, `low-power` when the device is too slow
 * even at the lightest quality (the scene has frozen; stop it once its canvas has faded out).
 */
export type SceneState = "running" | "lost" | "low-power";

interface SceneOptions {
  /** False renders a single still frame, for visitors who prefer reduced motion. */
  animate: boolean;
  onStateChange: (state: SceneState) => void;
}

/**
 * Ends the current task, so the browser can respond to input and paint before the next step.
 * Startup is split this way into several short tasks instead of one long one.
 */
function nextTask(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

export interface SceneHandle {
  /** Stops for good and releases everything: listeners, observers and the GPU's memory. */
  stop: () => void;
}

/**
 * Starts the scene on a canvas whose WebGL2 context the caller already created
 * (creating it first is how the caller learns WebGL2 works before downloading Three.js).
 * Resolves once the first frame is on screen.
 */
export async function startScene(
  canvas: HTMLCanvasElement,
  context: WebGL2RenderingContext,
  { animate, onStateChange }: SceneOptions,
): Promise<SceneHandle> {
  const renderer = new WebGLRenderer({ canvas, context });
  renderer.setClearColor(BACKGROUND);
  await nextTask();

  const camera = createCamera(1);
  const gusts = new GustField();
  const light = lightAt(SCENE_SETTINGS.startPhase);
  const flags = new URLSearchParams(location.search);
  const signals = readDeviceSignals(context);
  // ?quality=high|medium|low|minimal locks the tier: no stepping down, no giving up. For screen
  // recordings, comparing tiers by eye, and tests that need the scene to keep running.
  // ?quality=auto (or any other value) keeps the automatic tiers. Either way, main.ts runs the
  // scene even on software-only WebGL, where the page otherwise shows the poster.
  const lockedTier = QUALITY_TIERS.findIndex((tier) => tier.name === flags.get("quality"));
  const adaptive = lockedTier === -1;
  let tierIndex = adaptive ? initialTier(signals) : lockedTier;

  // The scene's clock, in seconds: starts at `startTime` with the first frame and stands still
  // while the scene is paused. Animation frames and pointer events both read it.
  let clockOrigin = performance.now();
  let pausedMs = 0;
  const sceneSeconds = (nowMs: number) =>
    SCENE_SETTINGS.startTime + (nowMs - clockOrigin - pausedMs) / 1000;

  // Shared by the sky and the dunes; colours are display (sRGB) values the shaders write out as is.
  const time = { value: 0 };
  const horizon = { value: new Vector3() };

  const duneUniforms = {
    uTime: time,
    uPixelRatio: { value: 1 },
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
  const duneMaterial = new ShaderMaterial({
    vertexShader: `${noise}\n${duneVertexShader}`,
    fragmentShader,
    uniforms: duneUniforms,
    defines: { MAX_GUSTS },
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  // The geometry comes from the quality tier (applyTier).
  const dunes = new Points(new BufferGeometry(), duneMaterial);
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
  const skyMaterial = new ShaderMaterial({
    vertexShader: skyVertexShader,
    fragmentShader: skyFragmentShader,
    uniforms: skyUniforms,
    depthTest: false,
    depthWrite: false,
  });
  const sky = new Mesh(new PlaneGeometry(2, 2), skyMaterial);
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

  /** Sets the grains and the pixel ratio for the current tier. */
  function applyTier(): void {
    const { lines, pointsPerLine, maxPixelRatio } = qualityTier(tierIndex);
    renderer.setPixelRatio(Math.min(devicePixelRatio, maxPixelRatio));
    duneUniforms.uPixelRatio.value = renderer.getPixelRatio();
    dunes.geometry.dispose();
    dunes.geometry = createDuneGeometry(lines, pointsPerLine, seededRandom(SCENE_SETTINGS.seed));
    resize();
  }
  applyTier();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  await nextTask();

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

  // Quality adapts to the frame rate: slow frames step it down a tier; when even the lightest
  // tier is too slow, the scene freezes and the page falls back to the poster.
  const monitor = new FrameMonitor();
  let lowPower = false;
  function frame(timeMs: number): void {
    render(timeMs);
    const budget = tierIndex < LIGHTEST_TIER ? STEP_DOWN_BUDGET_MS : GIVE_UP_BUDGET_MS;
    if (!monitor.frame(timeMs, budget) || !adaptive) return;
    if (tierIndex < LIGHTEST_TIER) {
      tierIndex += 1;
      applyTier();
      return;
    }
    lowPower = true;
    updateLoop();
    onStateChange("low-power");
  }

  // The loop runs only while it is worth it: animating, visible, on screen, with WebGL, not stopped.
  let hidden = document.visibilityState === "hidden";
  let offscreen = false;
  let contextLost = false;
  let stopped = false;
  let looping = false;
  let pausedAt = 0;
  function updateLoop(): void {
    const shouldLoop = animate && !hidden && !offscreen && !contextLost && !lowPower && !stopped;
    if (shouldLoop === looping) return;
    looping = shouldLoop;
    const now = performance.now();
    if (shouldLoop) {
      pausedMs += now - pausedAt;
      monitor.restart(now);
      renderer.setAnimationLoop(frame);
    } else {
      pausedAt = now;
      renderer.setAnimationLoop(null);
    }
  }
  const onVisibilityChange = () => {
    hidden = document.visibilityState === "hidden";
    updateLoop();
  };
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    offscreen = entry ? !entry.isIntersecting : false;
    updateLoop();
  });
  // Three.js restores its own state when WebGL comes back; the page only needs to know.
  const onContextLost = () => {
    contextLost = true;
    updateLoop();
    onStateChange("lost");
  };
  const onContextRestored = () => {
    contextLost = false;
    updateLoop();
    onStateChange("running");
  };

  // Compiles the shaders without blocking the main thread where the browser supports it.
  await renderer.compileAsync(scene, camera);
  clockOrigin = performance.now();
  render(clockOrigin);

  // Listeners added below, removed by stop().
  const removeListeners: (() => void)[] = [];
  function stop(): void {
    stopped = true;
    updateLoop();
    for (const remove of removeListeners) remove();
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    canvas.removeEventListener("webglcontextrestored", onContextRestored);
    dunes.geometry.dispose();
    duneMaterial.dispose();
    sky.geometry.dispose();
    skyMaterial.dispose();
    renderer.dispose();
    // Frees the GPU memory now rather than whenever the context is garbage collected.
    context.getExtension("WEBGL_lose_context")?.loseContext();
  }
  if (!animate) return { stop };

  document.addEventListener("visibilitychange", onVisibilityChange);
  intersectionObserver.observe(canvas);
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);
  pausedAt = clockOrigin;
  updateLoop();

  // A slot is reused only after its gust has settled, so the sand never snaps back early.
  const trail = new GustTrail(camera, gusts, SCENE_SETTINGS.gustLife / MAX_GUSTS);
  removeListeners.push(listenForGusts(trail, () => sceneSeconds(performance.now())));

  if (flags.has("debug")) {
    import("./debug").then(
      ({ openDebugOverlay }) => {
        openDebugOverlay(() => {
          const { lines, pointsPerLine, name } = qualityTier(tierIndex);
          return {
            ...monitor.stats(),
            tier: name,
            grains: lines * pointsPerLine,
            pixelRatio: renderer.getPixelRatio(),
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            renderer: signals.renderer,
            state: lowPower ? "low-power" : looping ? "running" : "paused",
          };
        });
      },
      (error: unknown) => {
        console.error("The debug overlay failed to load", error);
      },
    );
  }
  if (flags.has("tune")) {
    openTuning({
      duneUniforms,
      trail,
      nowSeconds: () => sceneSeconds(performance.now()),
      cycle: {
        phaseAt,
        setCycleSeconds: (seconds, phase) => {
          cycleSeconds = seconds;
          phaseStart = phase - sceneSeconds(performance.now()) / cycleSeconds;
        },
        setPhase: (phase) => {
          phaseStart = phase - sceneSeconds(performance.now()) / cycleSeconds;
        },
      },
    });
  }
  return { stop };
}

interface TuningTargets {
  duneUniforms: Record<
    | "uWindSpeed"
    | "uFlowStrength"
    | "uDuneHeight"
    | "uPointSize"
    | "uGustStrength"
    | "uGustRadius"
    | "uGustLife",
    { value: number }
  >;
  trail: GustTrail;
  nowSeconds: () => number;
  cycle: {
    phaseAt: (seconds: number) => number;
    setCycleSeconds: (seconds: number, keepPhase: number) => void;
    setPhase: (phase: number) => void;
  };
}

/** Opens the ?tune panel (its own lazy chunk) with live controls over the running scene. */
function openTuning({ duneUniforms, trail, nowSeconds, cycle }: TuningTargets): void {
  const uniformTunable = (
    name: string,
    min: number,
    max: number,
    step: number,
    uniform: { value: number },
  ): Tunable => ({ name, min, max, step, apply: (value) => (uniform.value = value) });
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
        cycle.setCycleSeconds(value, cycle.phaseAt(nowSeconds()));
      },
    },
    {
      // Jumps the light to a point of the cycle (0 dawn, 0.33 midday, 0.67 dusk); it moves on from there.
      name: "startPhase",
      min: 0,
      max: 1,
      step: 0.01,
      apply: (value) => {
        cycle.setPhase(value);
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
