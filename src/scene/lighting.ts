/** An sRGB colour, each channel 0..1. */
export type Rgb = [number, number, number];

/** The light at one moment of the day. Colours are display (sRGB) values. */
export interface Light {
  /** The sky at the top of the view. */
  skyTop: Rgb;
  /** The glow just above the horizon; far sand fades into it. */
  horizon: Rgb;
  /** The ground between the dune lines. */
  ground: Rgb;
  /** Sand facing the sun. */
  sandLit: Rgb;
  /** Sand turned away from it. */
  sandShade: Rgb;
  /** Direction toward the sun, seen from the camera: x from left (-1) to right (1), y up. */
  sun: [number, number];
}

function hex(value: string): Rgb {
  const channel = (offset: number) => parseInt(value.slice(offset, offset + 2), 16) / 255;
  return [channel(1), channel(3), channel(5)];
}

/** Low sun from the left: rose light on the windward faces, mauve shadows. */
export const DAWN: Light = {
  skyTop: hex("#0a0a10"),
  horizon: hex("#2a1a24"),
  ground: hex("#0c0a0d"),
  sandLit: hex("#f1c8b2"),
  sandShade: hex("#5e4d63"),
  sun: [-0.95, 0.3],
};

/** High sun: flat, bleached light, little contrast. */
export const MIDDAY: Light = {
  skyTop: hex("#0b0b0b"),
  horizon: hex("#26231c"),
  ground: hex("#0d0c0a"),
  sandLit: hex("#f3e8d0"),
  sandShade: hex("#8c7c60"),
  sun: [0.1, 1],
};

/** Low sun from the right: amber light, plum shadows. */
export const DUSK: Light = {
  skyTop: hex("#0b0908"),
  horizon: hex("#2e170d"),
  ground: hex("#0d0a09"),
  sandLit: hex("#efa463"),
  sandShade: hex("#553546"),
  sun: [0.95, 0.3],
};

/**
 * How much brighter than the horizon colour the sky gets where a low sun sits (the sky shader's
 * bloom). The brightest background behind the text is `horizon * (1 + SUN_GLOW)`.
 */
export const SUN_GLOW = 0.8;

/** The cycle runs dawn, midday, dusk and back to dawn, each a third of it. */
const KEYFRAMES = [DAWN, MIDDAY, DUSK];

function mixRgb(from: Rgb, to: Rgb, amount: number, into: Rgb): Rgb {
  for (let channel = 0; channel < 3; channel++) {
    const start = from[channel] ?? 0;
    into[channel] = start + ((to[channel] ?? 0) - start) * amount;
  }
  return into;
}

export function emptyLight(): Light {
  return {
    skyTop: [0, 0, 0],
    horizon: [0, 0, 0],
    ground: [0, 0, 0],
    sandLit: [0, 0, 0],
    sandShade: [0, 0, 0],
    sun: [0, 1],
  };
}

/**
 * The light at a point of the cycle (0 dawn, 1/3 midday, 2/3 dusk, 1 dawn again), eased between
 * keyframes so each one lingers. Writes into `into`, so the render loop allocates nothing.
 */
export function lightAt(phase: number, into: Light = emptyLight()): Light {
  const position = (((phase % 1) + 1) % 1) * KEYFRAMES.length;
  const index = Math.floor(position);
  const from = KEYFRAMES[index % KEYFRAMES.length] ?? DAWN;
  const to = KEYFRAMES[(index + 1) % KEYFRAMES.length] ?? DAWN;
  const linear = position - index;
  const eased = linear * linear * (3 - 2 * linear);

  mixRgb(from.skyTop, to.skyTop, eased, into.skyTop);
  mixRgb(from.horizon, to.horizon, eased, into.horizon);
  mixRgb(from.ground, to.ground, eased, into.ground);
  mixRgb(from.sandLit, to.sandLit, eased, into.sandLit);
  mixRgb(from.sandShade, to.sandShade, eased, into.sandShade);
  const sunX = from.sun[0] + (to.sun[0] - from.sun[0]) * eased;
  const sunY = from.sun[1] + (to.sun[1] - from.sun[1]) * eased;
  const length = Math.hypot(sunX, sunY);
  into.sun[0] = sunX / length;
  into.sun[1] = sunY / length;
  return into;
}

/** WCAG relative luminance of an sRGB colour. */
function luminance([red, green, blue]: Rgb): number {
  const linear = (channel: number) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

/** WCAG contrast ratio between two colours, 1 to 21. */
export function contrastRatio(first: Rgb, second: Rgb): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}
