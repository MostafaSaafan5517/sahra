/** One level of quality: how many grains, and the highest pixel ratio the canvas renders at. */
export interface QualityTier {
  name: string;
  lines: number;
  pointsPerLine: number;
  maxPixelRatio: number;
}

const LIGHTEST: QualityTier = {
  name: "minimal",
  lines: 48,
  pointsPerLine: 192,
  maxPixelRatio: 0.75,
};

/** From best to lightest. The scene starts at one of these and only ever steps down. */
export const QUALITY_TIERS: readonly QualityTier[] = [
  { name: "high", lines: 96, pointsPerLine: 512, maxPixelRatio: 2 },
  { name: "medium", lines: 80, pointsPerLine: 384, maxPixelRatio: 1.5 },
  { name: "low", lines: 64, pointsPerLine: 256, maxPixelRatio: 1 },
  LIGHTEST,
];

/** The tier at an index into QUALITY_TIERS, clamped to the list. */
export function qualityTier(index: number): QualityTier {
  return QUALITY_TIERS[Math.min(Math.max(index, 0), QUALITY_TIERS.length - 1)] ?? LIGHTEST;
}

const HIGH = 0;
const MEDIUM = 1;
const LOW = 2;
const MINIMAL = 3;

/** What the browser tells us about the device, read once before the scene starts. */
export interface DeviceSignals {
  /** Logical processor cores (`navigator.hardwareConcurrency`). */
  cores: number;
  /** Approximate memory in GB (`navigator.deviceMemory`); Chrome only, so often unknown. */
  memoryGb: number | undefined;
  /** A touch screen as the main input: a phone or tablet. */
  touchFirst: boolean;
  /** The visitor asked their browser to save data. */
  saveData: boolean;
  /** The WebGL renderer's name, when the browser shares it. */
  renderer: string;
}

/** Renderers that draw on the CPU: Chrome's SwiftShader, Mesa's llvmpipe, Windows' fallback. */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i;

export function isSoftwareRenderer(renderer: string): boolean {
  return SOFTWARE_RENDERER.test(renderer);
}

/**
 * The tier to start at (an index into QUALITY_TIERS). A first guess only: the frame-rate monitor
 * steps down from here if frames are slow, so the guess errs toward quality on capable devices
 * and toward lightness where the signals point to a weak one.
 */
export function initialTier(signals: DeviceSignals): number {
  if (isSoftwareRenderer(signals.renderer)) return MINIMAL;
  if (signals.saveData) return LOW;
  if (signals.cores <= 2 || (signals.memoryGb !== undefined && signals.memoryGb <= 2)) return LOW;
  if (!signals.touchFirst) return signals.cores >= 4 ? HIGH : MEDIUM;
  // Phones and tablets. Safari does not report memory: assume a typical 4 GB.
  const memoryGb = signals.memoryGb ?? 4;
  if (memoryGb >= 6 && signals.cores >= 8) return HIGH;
  return memoryGb >= 4 ? MEDIUM : LOW;
}

/** The index into QUALITY_TIERS of the tier with this name, or -1 when there is none. */
export function tierNamed(name: string | undefined): number {
  return QUALITY_TIERS.findIndex((tier) => tier.name === name);
}

/** The WebGL renderer's name (the GPU, or the software renderer), when the browser shares it. */
export function rendererName(gl: WebGL2RenderingContext): string {
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const name: unknown = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "";
  return typeof name === "string" ? name : "";
}

/** Reads the device signals in the browser, using the scene's own WebGL context for the renderer. */
export function readDeviceSignals(gl: WebGL2RenderingContext): DeviceSignals {
  const { deviceMemory, connection } = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  return {
    cores: navigator.hardwareConcurrency,
    memoryGb: deviceMemory,
    touchFirst: matchMedia("(pointer: coarse)").matches,
    saveData: connection?.saveData === true,
    renderer: rendererName(gl),
  };
}
