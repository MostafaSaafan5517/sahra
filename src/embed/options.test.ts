import { describe, expect, it } from "vitest";
import { DAWN, DUSK, MIDDAY } from "../scene/lighting";
import { embedOptions, parseColour } from "./options";

describe("parseColour", () => {
  it("reads six-digit and three-digit hex colours, in any case", () => {
    expect(parseColour("#ff8000")).toEqual([1, 128 / 255, 0]);
    expect(parseColour("#F80")).toEqual([1, 136 / 255, 0]);
    expect(parseColour("  #000000 ")).toEqual([0, 0, 0]);
  });

  it("refuses anything else", () => {
    for (const value of ["blue", "#ff80", "ff8000", "#ff800g", "rgb(255, 128, 0)", ""]) {
      expect(parseColour(value), value).toBeNull();
    }
  });
});

describe("embedOptions", () => {
  it("cycles through the day, adapts the quality and never forces the scene by default", () => {
    expect(embedOptions({})).toEqual({
      force: false,
      lockedTier: undefined,
      highestTier: undefined,
      light: undefined,
      warnings: [],
    });
  });

  it("holds a named light", () => {
    expect(embedOptions({ light: "dawn" }).light).toEqual(DAWN);
    expect(embedOptions({ light: "midday" }).light).toEqual(MIDDAY);
    expect(embedOptions({ light: "cycle" }).light).toBeUndefined();
  });

  it("holds dusk with the colours given, unless another light is named", () => {
    expect(embedOptions({ sand: "#ffffff" }).light).toEqual({ ...DUSK, sandLit: [1, 1, 1] });
    expect(embedOptions({ light: "dawn", sky: "#000", shade: "#ff0000" }).light).toEqual({
      ...DAWN,
      skyTop: [0, 0, 0],
      sandShade: [1, 0, 0],
    });
  });

  it("caps the density and forces the scene only when asked", () => {
    expect(embedOptions({ density: "low" }).highestTier).toBe("low");
    expect(embedOptions({ quality: "minimal" })).toMatchObject({
      force: true,
      lockedTier: "minimal",
    });
    expect(embedOptions({ quality: "auto" })).toMatchObject({ force: true, lockedTier: "auto" });
  });

  it("explains what it cannot use, and goes on without it", () => {
    const options = embedOptions({
      light: "noon",
      sand: "gold",
      density: "dense",
      horizon: "#123",
    });
    expect(options.warnings).toEqual([
      'data-light="noon" is not a light (cycle, dawn, midday or dusk).',
      'data-sand="gold" is not a colour like #efa463.',
      'data-density="dense" is not a density (high, medium, low or minimal).',
    ]);
    expect(options.light).toEqual({ ...DUSK, horizon: [0x11 / 255, 0x22 / 255, 0x33 / 255] });
  });
});
