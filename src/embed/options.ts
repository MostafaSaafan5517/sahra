import { DAWN, DUSK, type Light, MIDDAY, type Rgb } from "../scene/lighting";
import { tierNamed } from "../scene/quality";

/** The fixed lights `data-light` can name; `cycle` (the default) moves through the day instead. */
const LIGHTS: Record<string, Light> = { dawn: DAWN, midday: MIDDAY, dusk: DUSK };

/** The colours an embed can set, by data attribute, and the part of the light each replaces. */
const COLOURS = {
  sky: "skyTop",
  horizon: "horizon",
  ground: "ground",
  sand: "sandLit",
  shade: "sandShade",
} as const;

export interface EmbedOptions {
  /** Run even on software-only WebGL: set by `data-quality`, for tests and recordings. */
  force: boolean;
  lockedTier: string | undefined;
  highestTier: string | undefined;
  /** A fixed light, or undefined for the day's cycle. */
  light: Light | undefined;
  /** What could not be used, for the console; the scene starts anyway, without it. */
  warnings: string[];
}

/** "#rgb" or "#rrggbb" as an sRGB colour with channels from 0 to 1, or null. */
export function parseColour(value: string): Rgb | null {
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(value.trim())?.[1];
  if (!hex) return null;
  // "#f80" is short for "#ff8800": each digit doubled.
  const full = hex.length === 3 ? hex.replace(/./g, "$&$&") : hex;
  return [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16) / 255) as Rgb;
}

/**
 * Reads an embed's options from its container's data attributes:
 *
 * - `data-light`: `cycle` (the default: dawn, midday and dusk in turn), or `dawn`, `midday` or
 *   `dusk` to hold one light.
 * - `data-sky`, `data-horizon`, `data-ground`, `data-sand` and `data-shade`: colours (`#rgb` or
 *   `#rrggbb`) for the top of the sky, the glow above the horizon, the ground between the dune
 *   lines, sand facing the sun and sand in shade. Any colour holds the light (dusk, unless
 *   `data-light` names another) with the colours given replacing its own.
 * - `data-density`: `high`, `medium`, `low` or `minimal`, the most grains the scene may use. It
 *   still starts lighter on a weaker device, and steps down if frames are slow.
 * - `data-quality`: a tier's name locks the quality there, `auto` keeps it adaptive; either way the
 *   scene runs even where WebGL is drawn in software. For tests and screen recordings.
 */
export function embedOptions(data: Readonly<Record<string, string | undefined>>): EmbedOptions {
  const warnings: string[] = [];

  const lightName = data.light ?? "cycle";
  let base = LIGHTS[lightName];
  if (!base && lightName !== "cycle") {
    warnings.push(`data-light="${lightName}" is not a light (cycle, dawn, midday or dusk).`);
  }
  const colours: Partial<Light> = {};
  for (const [attribute, key] of Object.entries(COLOURS)) {
    const value = data[attribute];
    if (value === undefined) continue;
    const colour = parseColour(value);
    if (colour) colours[key] = colour;
    else warnings.push(`data-${attribute}="${value}" is not a colour like #efa463.`);
  }
  if (Object.keys(colours).length > 0) base ??= DUSK;

  const density = data.density;
  if (density !== undefined && tierNamed(density) === -1) {
    warnings.push(`data-density="${density}" is not a density (high, medium, low or minimal).`);
  }

  return {
    force: data.quality !== undefined,
    lockedTier: data.quality,
    highestTier: density,
    light: base ? { ...base, ...colours } : undefined,
    warnings,
  };
}
