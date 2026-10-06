import { describe, expect, it } from "vitest";
import { createDuneGeometry, seededRandom } from "./dunes";

function layoutOf(lines: number, pointsPerLine: number) {
  const positions = createDuneGeometry(lines, pointsPerLine, seededRandom(7)).getAttribute(
    "position",
  );
  return Array.from({ length: positions.count }, (_, index) => ({
    along: positions.getX(index),
    line: positions.getY(index),
    seed: positions.getZ(index),
  }));
}

describe("createDuneGeometry", () => {
  it("makes one point per line and place along it", () => {
    expect(layoutOf(96, 512)).toHaveLength(49_152);
  });

  it("stores the farthest line first and the nearest last", () => {
    const points = layoutOf(4, 3);
    expect(points.map((point) => point.line)).toEqual(
      [0, 0, 0, 1 / 3, 1 / 3, 1 / 3, 2 / 3, 2 / 3, 2 / 3, 1, 1, 1].map(Math.fround),
    );
  });

  it("spreads each line's points evenly from left to right, each within its own slot", () => {
    const pointsPerLine = 8;
    const firstLine = layoutOf(1, pointsPerLine);
    firstLine.forEach((point, index) => {
      expect(point.along).toBeGreaterThanOrEqual(-1 + (2 * index) / pointsPerLine);
      expect(point.along).toBeLessThan(-1 + (2 * (index + 1)) / pointsPerLine);
    });
  });

  it("gives every point a random number between 0 and 1", () => {
    const seeds = layoutOf(10, 100).map((point) => point.seed);
    expect(Math.min(...seeds)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...seeds)).toBeLessThan(1);
    expect(new Set(seeds).size).toBeGreaterThan(990);
  });
});

describe("seededRandom", () => {
  it("repeats the same sequence for the same seed", () => {
    const first = seededRandom(42);
    const second = seededRandom(42);
    expect(Array.from({ length: 5 }, first)).toEqual(Array.from({ length: 5 }, second));
  });

  it("gives a different sequence for a different seed", () => {
    expect(seededRandom(1)()).not.toBe(seededRandom(2)());
  });

  it("stays in [0, 1) and spreads evenly", () => {
    const random = seededRandom(3);
    const values = Array.from({ length: 10_000 }, random);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(mean).toBeCloseTo(0.5, 1);
  });
});
