import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  DAWN,
  DUSK,
  lightAt,
  MIDDAY,
  SUN_GLOW,
  type Light,
  type Rgb,
} from "./lighting";

/** The page's text colours today (Tailwind neutral-100 and neutral-300); Phase 4 may change them. */
const TEXT_COLOURS: Record<string, Rgb> = {
  heading: [0xf5 / 255, 0xf5 / 255, 0xf5 / 255],
  body: [0xd4 / 255, 0xd4 / 255, 0xd4 / 255],
};

function close(light: Light, expected: Light) {
  for (const key of ["skyTop", "horizon", "ground", "sandLit", "sandShade"] as const) {
    light[key].forEach((channel, index) => {
      expect(channel).toBeCloseTo(expected[key][index] ?? NaN, 5);
    });
  }
  const length = Math.hypot(...expected.sun);
  expect(light.sun[0]).toBeCloseTo(expected.sun[0] / length, 5);
  expect(light.sun[1]).toBeCloseTo(expected.sun[1] / length, 5);
}

describe("lightAt", () => {
  it("is dawn at the start, midday at a third, dusk at two thirds", () => {
    close(lightAt(0), DAWN);
    close(lightAt(1 / 3), MIDDAY);
    close(lightAt(2 / 3), DUSK);
  });

  it("wraps around, so the cycle repeats and negative phases work", () => {
    close(lightAt(1), DAWN);
    close(lightAt(2 + 1 / 3), MIDDAY);
    close(lightAt(-1 / 3), DUSK);
  });

  it("lies between two keyframes halfway through, and eases into each one", () => {
    const halfway = lightAt(1 / 6);
    const nearDawn = lightAt(0.01);
    halfway.sandLit.forEach((channel, index) => {
      const low = Math.min(DAWN.sandLit[index] ?? 0, MIDDAY.sandLit[index] ?? 0);
      const high = Math.max(DAWN.sandLit[index] ?? 0, MIDDAY.sandLit[index] ?? 0);
      expect(channel).toBeGreaterThanOrEqual(low);
      expect(channel).toBeLessThanOrEqual(high);
    });
    // 3% of the way in time, but eased: well under 3% of the way in colour.
    const travelled =
      (nearDawn.sandLit[0] - DAWN.sandLit[0]) / (MIDDAY.sandLit[0] - DAWN.sandLit[0]);
    expect(travelled).toBeLessThan(0.01);
  });

  it("keeps the sun direction a unit vector", () => {
    for (let phase = 0; phase < 1; phase += 0.05) {
      expect(Math.hypot(...lightAt(phase).sun)).toBeCloseTo(1, 6);
    }
  });

  it("writes into the light it is given instead of making a new one", () => {
    const reused = lightAt(0);
    expect(lightAt(0.5, reused)).toBe(reused);
  });
});

describe("contrastRatio", () => {
  it("matches the WCAG reference values", () => {
    expect(contrastRatio([1, 1, 1], [0, 0, 0])).toBeCloseTo(21, 5);
    expect(contrastRatio([0, 0, 0], [0, 0, 0])).toBeCloseTo(1, 5);
    // #767676 on white is the classic 4.54:1.
    expect(contrastRatio([0x76 / 255, 0x76 / 255, 0x76 / 255], [1, 1, 1])).toBeCloseTo(4.54, 2);
  });
});

describe("text over the scene's background", () => {
  it("keeps WCAG AA contrast (4.5:1) against the sky and ground, all through the cycle", () => {
    let lowest = Infinity;
    for (let step = 0; step < 300; step++) {
      const light = lightAt(step / 300);
      const sunBloom = light.horizon.map((channel) => channel * (1 + SUN_GLOW)) as Rgb;
      for (const background of [light.skyTop, light.horizon, sunBloom, light.ground]) {
        for (const text of Object.values(TEXT_COLOURS)) {
          lowest = Math.min(lowest, contrastRatio(text, background));
        }
      }
    }
    expect(lowest).toBeGreaterThanOrEqual(4.5);
  });
});
